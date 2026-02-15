import React, { useMemo } from 'react';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../constants/holoTheme';
import { getBattleStartDate } from '../../constants/battleTiming';
import { isMarketHoliday, formatDateString } from '../../utils/marketHolidays';

/**
 * DailyScoresModal - Shows daily score breakdown for the battle
 *
 * Displays:
 * - Daily standings for each day of the battle (5 days for Snake Draft)
 * - Day status: COMPLETE, IN PROGRESS, or UPCOMING
 * - Overall cumulative standings
 * - Highlights current user with "(YOU)" and gold/green styling
 * - Shows medals for daily winner and overall leader
 */
const DailyScoresModal = ({
  isOpen,
  onClose,
  standings,          // Current standings with player data
  currentUserId,      // Current user's ID for highlighting
  battleStartTime,    // When the battle started
  battleStartDate,    // YYYY-MM-DD for Day 1 (new: correct start date)
  battleEndTime,      // When the battle ends
  dailyScores = null, // Daily score snapshots from Firebase (formatted for modal)
  dailyData = null,   // Full daily data with detailed asset breakdowns
  currentDay = 0,     // Current trading day (1-5)
}) => {
  // Calculate battle day info - only trading days (Mon-Fri)
  const battleDays = useMemo(() => {
    if (!battleStartDate && !battleStartTime) return [];

    const now = new Date();
    const totalDays = 5; // Snake Draft is 5 trading days
    const days = [];

    let checkDate;

    if (battleStartDate) {
      // New path: use explicit YYYY-MM-DD start date
      checkDate = new Date(battleStartDate + 'T12:00:00');
      checkDate.setHours(0, 0, 0, 0);
    } else {
      // Legacy path: compute correct start date from battleStartTime
      // This handles the case where battleStartDate is missing from Firestore
      // getBattleStartDate defers to next trading day if completed during/after market hours
      const computedStartDate = getBattleStartDate(battleStartTime);
      checkDate = new Date(computedStartDate + 'T12:00:00');
      checkDate.setHours(0, 0, 0, 0);
    }

    let tradingDayCount = 0;

    while (tradingDayCount < totalDays) {
      const dayOfWeek = checkDate.getDay();

      // Skip weekends and market holidays
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isMarketHoliday(formatDateString(checkDate))) {
        tradingDayCount++;

        const dayDate = new Date(checkDate);

        // Determine day status based on current time
        let status = 'UPCOMING';
        const dayEnd = new Date(dayDate);
        dayEnd.setHours(23, 59, 59, 999);

        const dayStart = new Date(dayDate);
        dayStart.setHours(0, 0, 0, 0);

        if (now > dayEnd) {
          status = 'COMPLETE';
        } else if (now >= dayStart && now <= dayEnd) {
          status = 'IN PROGRESS';
        }

        // Format date
        const dayOfWeekNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedDate = `${dayOfWeekNames[dayDate.getDay()]} ${monthNames[dayDate.getMonth()]} ${dayDate.getDate()}`;

        days.push({
          dayNumber: tradingDayCount,
          date: dayDate,
          formattedDate,
          status,
        });
      }

      checkDate.setDate(checkDate.getDate() + 1);
    }

    return days;
  }, [battleStartTime, battleStartDate]);

  // Calculate daily scores for each day
  // Uses dailyData for accurate recorded scores, dailyScores for formatted totals
  const dailyStandings = useMemo(() => {
    if (!standings?.length || !battleDays.length) return [];

    return battleDays.map((day, dayIndex) => {
      const dayNum = dayIndex + 1;
      const dayKey = `day${dayNum}`;
      const dayDataEntry = dailyData?.[dayKey];
      const dayScoreEntry = dailyScores?.[dayKey];

      // Determine actual status based on dailyData
      let actualStatus = day.status;
      if (dayDataEntry?.recorded) {
        actualStatus = 'COMPLETE';
      } else if (dayNum === currentDay && currentDay > 0) {
        actualStatus = 'IN PROGRESS';
      } else if (dayNum > currentDay || currentDay === 0) {
        actualStatus = 'UPCOMING';
      }

      // If day is recorded (COMPLETE), use the actual scores
      if (dayDataEntry?.closeScores) {
        const dayStandings = standings.map(player => {
          const playerDayScore = dayDataEntry.closeScores[player.odUserId];
          return {
            odUserId: player.odUserId,
            displayName: player.displayName,
            isMe: player.odUserId === currentUserId,
            points: playerDayScore?.totalPoints ?? 0,
            assets: playerDayScore?.assets || [],
          };
        }).sort((a, b) => b.points - a.points);

        return {
          ...day,
          status: actualStatus,
          standings: dayStandings,
          hasDetailedData: true,
        };
      }

      // If we have formatted dailyScores (legacy format), use those
      if (dayScoreEntry) {
        const dayStandings = standings.map(player => ({
          odUserId: player.odUserId,
          displayName: player.displayName,
          isMe: player.odUserId === currentUserId,
          points: dayScoreEntry[player.odUserId] || 0,
        })).sort((a, b) => b.points - a.points);

        return {
          ...day,
          status: actualStatus,
          standings: dayStandings,
          hasDetailedData: false,
        };
      }

      // For current day IN PROGRESS, use live standings (today's points)
      if (actualStatus === 'IN PROGRESS') {
        const dayStandings = standings.map(player => ({
          odUserId: player.odUserId,
          displayName: player.displayName,
          isMe: player.odUserId === currentUserId,
          points: player.todayPoints ?? player.totalPoints ?? 0,
          isLive: true,
        })).sort((a, b) => b.points - a.points);

        return {
          ...day,
          status: actualStatus,
          standings: dayStandings,
          hasDetailedData: false,
        };
      }

      // UPCOMING days - no scores yet
      return {
        ...day,
        status: actualStatus,
        standings: standings.map(player => ({
          odUserId: player.odUserId,
          displayName: player.displayName,
          isMe: player.odUserId === currentUserId,
          points: null,
        })),
        hasDetailedData: false,
      };
    });
  }, [standings, battleDays, dailyScores, dailyData, currentUserId, currentDay]);

  // Overall standings (cumulative)
  const overallStandings = useMemo(() => {
    if (!standings?.length) return [];

    return standings.map(player => ({
      odUserId: player.odUserId,
      displayName: player.displayName,
      isMe: player.odUserId === currentUserId,
      points: player.totalPoints || 0,
    })).sort((a, b) => b.points - a.points);
  }, [standings, currentUserId]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: '400px',
        maxHeight: '80vh',
        background: 'linear-gradient(180deg, rgba(20, 25, 35, 0.98) 0%, rgba(10, 14, 20, 0.99) 100%)',
        borderRadius: '16px',
        border: `1px solid ${HOLO_COLORS.cyan}44`,
        boxShadow: `0 0 40px ${HOLO_COLORS.cyan}22, inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
        zIndex: 101,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'modalSlideIn 0.3s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0, 255, 255, 0.03)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{
              fontSize: '18px',
              textShadow: '0 0 8px rgba(0, 255, 255, 0.8), 0 0 16px rgba(0, 255, 255, 0.4)',
            }}>📊</span>
            <span style={{
              fontSize: '14px',
              fontWeight: 700,
              color: HOLO_COLORS.cyan,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              textShadow: `0 0 10px ${HOLO_COLORS.cyan}66`,
            }}>
              Daily Scores
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: HOLO_COLORS.textMuted,
              fontSize: '16px',
              transition: 'all 0.2s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
        }}>
          {/* Pre-battle banner when all days are upcoming */}
          {battleStartDate && currentDay === 0 && (
            <div style={{
              padding: '12px 16px',
              marginBottom: '16px',
              background: 'rgba(0, 255, 255, 0.08)',
              borderRadius: '10px',
              border: `1px solid ${HOLO_COLORS.cyan}44`,
              textAlign: 'center',
            }}>
              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                color: HOLO_COLORS.cyan,
              }}>
                Battle starts {battleStartDate} at market open (9:30 AM ET)
              </span>
            </div>
          )}

          {/* Daily Scores */}
          {dailyStandings.map((day, dayIdx) => (
            <div key={day.dayNumber} style={{ marginBottom: '20px' }}>
              {/* Day Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: HOLO_COLORS.textPrimary,
                }}>
                  DAY {day.dayNumber} ({day.formattedDate})
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: day.status === 'COMPLETE'
                    ? 'rgba(0, 255, 136, 0.15)'
                    : day.status === 'IN PROGRESS'
                      ? 'rgba(0, 255, 255, 0.15)'
                      : 'rgba(255, 255, 255, 0.05)',
                  color: day.status === 'COMPLETE'
                    ? HOLO_COLORS.green
                    : day.status === 'IN PROGRESS'
                      ? HOLO_COLORS.cyan
                      : HOLO_COLORS.textMuted,
                  border: `1px solid ${
                    day.status === 'COMPLETE'
                      ? HOLO_COLORS.green + '44'
                      : day.status === 'IN PROGRESS'
                        ? HOLO_COLORS.cyan + '44'
                        : HOLO_COLORS.borderSubtle
                  }`,
                }}>
                  {day.status}
                </span>
              </div>

              {/* Day Standings */}
              <div style={{
                background: HOLO_COLORS.bgCard,
                borderRadius: '10px',
                border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                overflow: 'hidden',
              }}>
                {day.standings.map((player, rank) => {
                  const isWinner = rank === 0 && player.points !== null && day.status !== 'UPCOMING';
                  const isLive = player.isLive || day.status === 'IN PROGRESS';
                  const pointsDisplay = player.points !== null
                    ? `${player.points >= 0 ? '+' : ''}${player.points.toFixed(0)} pts${isLive ? '' : ''}`
                    : '—';

                  return (
                    <div
                      key={player.odUserId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderBottom: rank < day.standings.length - 1
                          ? `1px solid ${HOLO_COLORS.borderSubtle}`
                          : 'none',
                        background: player.isMe
                          ? 'rgba(0, 255, 255, 0.08)'
                          : 'transparent',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}>
                        {/* Rank */}
                        <span style={{
                          width: '20px',
                          textAlign: 'center',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: rank === 0 ? HOLO_COLORS.gold
                            : rank === 1 ? HOLO_COLORS.silver
                            : rank === 2 ? HOLO_COLORS.bronze
                            : HOLO_COLORS.textMuted,
                        }}>
                          {rank + 1}.
                        </span>

                        {/* Name */}
                        <span style={{
                          fontSize: '13px',
                          fontWeight: player.isMe ? 700 : 500,
                          color: player.isMe ? HOLO_COLORS.cyan : HOLO_COLORS.textPrimary,
                        }}>
                          {player.displayName}
                          {player.isMe && (
                            <span style={{
                              marginLeft: '6px',
                              fontSize: '10px',
                              color: HOLO_COLORS.cyan,
                              fontWeight: 600,
                            }}>
                              (YOU)
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Points + Medal */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        {isLive && (
                          <span style={{
                            fontSize: '8px',
                            fontWeight: 600,
                            color: HOLO_COLORS.cyan,
                            background: 'rgba(0, 255, 255, 0.15)',
                            padding: '2px 4px',
                            borderRadius: '3px',
                            textTransform: 'uppercase',
                          }}>
                            LIVE
                          </span>
                        )}
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          color: player.points === null
                            ? HOLO_COLORS.textMuted
                            : player.points >= 0
                              ? HOLO_COLORS.green
                              : HOLO_COLORS.red,
                        }}>
                          {pointsDisplay}
                        </span>
                        {isWinner && (
                          <span style={{
                            fontSize: '14px',
                            textShadow: '0 0 8px rgba(255, 215, 0, 0.8), 0 0 16px rgba(255, 215, 0, 0.4)',
                          }}>🥇</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Divider */}
          <div style={{
            height: '1px',
            background: `linear-gradient(90deg, transparent 0%, ${HOLO_COLORS.cyan}44 20%, ${HOLO_COLORS.cyan}44 80%, transparent 100%)`,
            margin: '24px 0 20px',
          }} />

          {/* Overall Standings */}
          <div>
            <div style={{
              fontSize: '12px',
              fontWeight: 700,
              color: HOLO_COLORS.gold,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '10px',
              textShadow: '0 0 10px rgba(255, 215, 0, 0.4)',
            }}>
              Overall Standings
            </div>

            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.08) 0%, rgba(255, 215, 0, 0.02) 100%)',
              borderRadius: '10px',
              border: `1px solid ${HOLO_COLORS.gold}33`,
              overflow: 'hidden',
            }}>
              {overallStandings.map((player, rank) => {
                const isLeader = rank === 0;

                return (
                  <div
                    key={player.odUserId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderBottom: rank < overallStandings.length - 1
                        ? `1px solid ${HOLO_COLORS.borderSubtle}`
                        : 'none',
                      background: player.isMe
                        ? 'rgba(0, 255, 255, 0.1)'
                        : isLeader
                          ? 'rgba(255, 215, 0, 0.08)'
                          : 'transparent',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}>
                      {/* Rank */}
                      <span style={{
                        width: '22px',
                        textAlign: 'center',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: rank === 0 ? HOLO_COLORS.gold
                          : rank === 1 ? HOLO_COLORS.silver
                          : rank === 2 ? HOLO_COLORS.bronze
                          : HOLO_COLORS.textMuted,
                      }}>
                        {rank + 1}.
                      </span>

                      {/* Name */}
                      <span style={{
                        fontSize: '14px',
                        fontWeight: player.isMe || isLeader ? 700 : 500,
                        color: player.isMe ? HOLO_COLORS.cyan
                          : isLeader ? HOLO_COLORS.gold
                          : HOLO_COLORS.textPrimary,
                      }}>
                        {player.displayName}
                        {player.isMe && (
                          <span style={{
                            marginLeft: '6px',
                            fontSize: '10px',
                            color: HOLO_COLORS.cyan,
                            fontWeight: 600,
                          }}>
                            (YOU)
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Points + Trophy */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: player.points >= 0 ? HOLO_COLORS.green : HOLO_COLORS.red,
                        textShadow: isLeader ? '0 0 8px rgba(0, 255, 136, 0.5)' : 'none',
                      }}>
                        {player.points >= 0 ? '+' : ''}{player.points.toFixed(0)} pts
                      </span>
                      {isLeader && (
                        <span style={{
                          fontSize: '16px',
                          textShadow: '0 0 8px rgba(255, 215, 0, 0.6)',
                        }}>🏆</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
          background: 'rgba(0, 0, 0, 0.2)',
        }}>
          <p style={{
            margin: 0,
            fontSize: '10px',
            color: HOLO_COLORS.textMuted,
            textAlign: 'center',
          }}>
            Daily scores update at market close (4:00 PM ET)
          </p>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -45%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </>
  );
};

export default DailyScoresModal;
