/**
 * TournamentHistoryCard
 * Expandable card showing a completed tournament and user's performance
 */

import React, { useState } from 'react';

const TournamentHistoryCard = ({ tournament }) => {
  const [expanded, setExpanded] = useState(false);

  const {
    name,
    endDate,
    userEntries,
    totalParticipants,
    userBestRank,
    userBestReturn
  } = tournament;

  // Parse end date
  let endDateObj;
  if (endDate?.toDate) {
    endDateObj = endDate.toDate();
  } else if (endDate?._seconds) {
    endDateObj = new Date(endDate._seconds * 1000);
  } else {
    endDateObj = new Date(endDate);
  }

  const formattedDate = endDateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Determine rank badge
  const getRankBadge = (rank) => {
    if (!rank) return null;
    if (rank === 1) return { emoji: '🥇', color: '#fbbf24', label: '1st' };
    if (rank === 2) return { emoji: '🥈', color: '#9ca3af', label: '2nd' };
    if (rank === 3) return { emoji: '🥉', color: '#cd7f32', label: '3rd' };
    if (rank <= 10) return { emoji: '🏆', color: '#10b981', label: `${rank}th` };
    return { emoji: '', color: '#6b7280', label: `${rank}th` };
  };

  const rankBadge = getRankBadge(userBestRank);
  const participated = userEntries && userEntries.length > 0;

  return (
    <div style={{
      background: '#12121a',
      border: '1px solid #21262d',
      borderRadius: '12px',
      overflow: 'hidden',
      marginBottom: '12px'
    }}>
      {/* Main Card Header */}
      <div
        onClick={() => participated && setExpanded(!expanded)}
        style={{
          padding: '16px',
          cursor: participated ? 'pointer' : 'default',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <div style={{
            color: '#ffffff',
            fontWeight: '600',
            fontSize: '15px',
            marginBottom: '4px'
          }}>
            {name || `Week ${tournament.id?.split('_W')[1] || '?'}`}
          </div>
          <div style={{
            color: '#6b7280',
            fontSize: '12px'
          }}>
            Ended {formattedDate} • {totalParticipants} participants
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          {participated ? (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent: 'flex-end'
              }}>
                {rankBadge && (
                  <span style={{ fontSize: '16px' }}>{rankBadge.emoji}</span>
                )}
                <span style={{
                  color: rankBadge?.color || '#ffffff',
                  fontWeight: '700',
                  fontSize: '16px'
                }}>
                  {rankBadge?.label || '-'}
                </span>
              </div>
              <div style={{
                color: userBestReturn >= 0 ? '#10b981' : '#ef4444',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                {userBestReturn >= 0 ? '+' : ''}{userBestReturn?.toFixed(2)}%
              </div>
            </>
          ) : (
            <span style={{
              color: '#4b5563',
              fontSize: '12px',
              fontStyle: 'italic'
            }}>
              Did not enter
            </span>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && participated && (
        <div style={{
          borderTop: '1px solid #21262d',
          padding: '12px 16px',
          background: '#0d0d12'
        }}>
          <div style={{
            color: '#9ca3af',
            fontSize: '11px',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Your Entries ({userEntries.length})
          </div>

          {userEntries.map((entry, idx) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: '#12121a',
                borderRadius: '8px',
                marginBottom: idx < userEntries.length - 1 ? '8px' : 0
              }}
            >
              <div>
                <div style={{ color: '#ffffff', fontSize: '13px' }}>
                  Entry #{entry.entryNumber || idx + 1}
                </div>
                <div style={{ color: '#6b7280', fontSize: '11px' }}>
                  {entry.contracts?.length || 0} contracts
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  color: '#9ca3af',
                  fontSize: '12px'
                }}>
                  Rank #{entry.rank || '-'}
                </div>
                <div style={{
                  color: (entry.results?.percentReturn || 0) >= 0 ? '#10b981' : '#ef4444',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {(entry.results?.percentReturn || 0) >= 0 ? '+' : ''}
                  {(entry.results?.percentReturn || 0).toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expand indicator */}
      {participated && (
        <div style={{
          textAlign: 'center',
          padding: '6px',
          color: '#4b5563',
          fontSize: '10px',
          borderTop: expanded ? 'none' : '1px solid #21262d'
        }}>
          {expanded ? '▲ Collapse' : '▼ Tap to see details'}
        </div>
      )}
    </div>
  );
};

export default TournamentHistoryCard;
