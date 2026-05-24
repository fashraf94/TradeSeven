import React from 'react';
import { HOLO_COLORS } from '../constants/holoTheme';

const BattleHistoryScreen = ({
  containerStyle,
  colors,
  previousBattles,
  completedDraftBattles,
  completedTrainingBattles,
  completedV4Battles = [],
  completedBaggerBombBattles = [],
  completedAgentBattles = [],
  historyTab,
  setHistoryTab,
  loadingTrainingBattles,
  user,
  onBack,
  sendRematchRequest,
  BattleHistoryCard,
  onOpenFilmRoom,
}) => {
  // Get completed battles based on tab
  // Use previousBattles state (from tradeseven_previous_battles localStorage)
  // instead of user.completedBattles which is never populated
  const allCompletedClassicBattles = previousBattles || [];
  const classicBattles = allCompletedClassicBattles.filter(b => b.isDraft !== true && b.battleType !== 'baggerbomb_training');

  // Merge localStorage archive + localStorage active V4 + Firestore completed, deduplicate by ID
  const mergedBaggerBombBattles = (() => {
    const seen = new Set();
    const all = [];
    for (const b of classicBattles) {
      const key = b.id || b.battleId;
      if (key && !seen.has(key)) { seen.add(key); all.push(b); }
    }
    for (const b of completedV4Battles) {
      if (b.id && !seen.has(b.id)) { seen.add(b.id); all.push(b); }
    }
    for (const b of completedBaggerBombBattles) {
      if (b.id && !seen.has(b.id)) { seen.add(b.id); all.push(b); }
    }
    return all.sort((a, b) =>
      new Date(b.completedAt || b.timeline?.completedAt || b.archivedAt || 0) -
      new Date(a.completedAt || a.timeline?.completedAt || a.archivedAt || 0)
    );
  })();

  // Select battles based on current tab
  const completedBattles = historyTab === 'draft'
    ? completedDraftBattles
    : historyTab === 'training'
      ? completedTrainingBattles
      : mergedBaggerBombBattles;

  // Helper: check if user won a battle (handles training username mismatch)
  const didUserWin = (b) => {
    if (b.won === true) return true;
    if (b.result?.winner === user?.username) return true;
    // Training/V4 fallback: result.winner stores in-game username, not odUserId
    if ((b.isTrainingBattle || b._v >= 3) && b.result?.winner) {
      const isCreator = b.creator?.odUserId === (user?.odUserId || user?.username)
        || b.creator?.username === user?.username;
      return isCreator
        ? b.result.winner === b.creator?.username
        : b.result.winner === b.opponent?.username;
    }
    return false;
  };

  const didUserLose = (b) => {
    if (b.won === false) return true;
    if ((b.isTrainingBattle || b._v >= 3) && b.result?.winner) {
      return !didUserWin(b);
    }
    if (b.result && b.result.winner && b.result.winner !== user?.username) return true;
    return false;
  };

  // Stats for the current tab
  const tabWins = completedBattles.filter(didUserWin).length;
  const tabLosses = completedBattles.filter(didUserLose).length;
  // For draft battles, podium (top 3) count can be useful
  const draftPodiums = historyTab === 'draft' ? completedBattles.filter(b => b.myRank && b.myRank <= 3).length : 0;
  // For training battles, count total completed
  const trainingCompleted = historyTab === 'training' ? completedBattles.length : 0;

  return (
    <div style={containerStyle}>
      <div className="min-h-screen" style={{ background: colors.background }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#161b22',
          borderBottom: '1px solid #21262d',
          padding: '16px',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div style={{ maxWidth: '896px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#00d9ff',
                fontWeight: '600',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </button>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>Battle History</h1>
            <div style={{ width: '64px' }}></div>
          </div>
        </div>

        <div style={{ maxWidth: '896px', margin: '0 auto', padding: '16px' }}>
          {/* Tab Buttons */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            padding: '4px',
            background: '#161b22',
            borderRadius: '12px',
            border: '1px solid #21262d'
          }}>
            <button
              onClick={() => setHistoryTab('classic')}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                background: historyTab === 'classic' ? '#00d9ff' : 'transparent',
                color: historyTab === 'classic' ? '#000000' : '#8b949e',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              BaggerBomb
            </button>
            <button
              onClick={() => setHistoryTab('draft')}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                background: historyTab === 'draft' ? '#8b5cf6' : 'transparent',
                color: historyTab === 'draft' ? '#ffffff' : '#8b949e',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Draft Mode
            </button>
            <button
              onClick={() => setHistoryTab('training')}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                background: historyTab === 'training' ? '#9333ea' : 'transparent',
                color: historyTab === 'training' ? '#ffffff' : '#8b949e',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Training
            </button>
          </div>

          {/* Agent Battles section — Voice Layer Phase 4 Film Room entry point.
              Surfaced above the per-tab content so completed agent battles are
              reachable from anywhere in Battle History. The section header
              renders unconditionally; the card list is swapped for an empty
              state when no completed agent battles exist yet. */}
          {Array.isArray(completedAgentBattles) && (
            <div
              style={{
                background: '#161b22',
                border: '1px solid #21262d',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                  padding: '0 4px',
                }}
              >
                <span style={{ fontSize: '16px' }}>🎬</span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#f59e0b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Agent Battles
                </span>
                <span style={{ fontSize: '11px', color: '#6e7681' }}>
                  ({completedAgentBattles.length})
                </span>
              </div>
              {completedAgentBattles.length === 0 ? (
                <div
                  style={{
                    padding: '20px 16px',
                    borderRadius: '8px',
                    border: '1px dashed #21262d',
                    background: '#0d1117',
                    color: '#6e7681',
                    fontSize: '12px',
                    textAlign: 'center',
                    lineHeight: 1.5,
                  }}
                >
                  No completed agent battles yet — when you complete an agent battle, it'll appear here for review.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {completedAgentBattles.map((b) => {
                  const myScore = b?.scoreState?.currentScore;
                  const oppScore = b?.scoreState?.opponentScore;
                  const completedAt = b?.completedAt;
                  let completedLabel = '';
                  if (completedAt) {
                    const d = completedAt?.toDate?.() || new Date(completedAt);
                    if (d && !Number.isNaN(d.getTime())) {
                      completedLabel = d.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });
                    }
                  }
                  const oppName =
                    b?.opponent?.username ||
                    b?.opponent?.displayName ||
                    'CPU Opponent';
                  const outcome =
                    myScore == null || oppScore == null
                      ? null
                      : myScore > oppScore
                      ? 'win'
                      : myScore < oppScore
                      ? 'loss'
                      : 'draw';
                  const outcomeColor =
                    outcome === 'win' ? '#10b981' : outcome === 'loss' ? '#ef4444' : '#6e7681';
                  const outcomeLabel =
                    outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : outcome === 'draw' ? 'D' : '·';

                  return (
                    <div
                      key={b.id}
                      style={{
                        background: '#0d1117',
                        border: '1px solid #21262d',
                        borderLeft: `3px solid ${outcomeColor}`,
                        borderRadius: '8px',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: outcomeColor,
                          minWidth: 16,
                          textAlign: 'center',
                        }}
                      >
                        {outcomeLabel}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          minWidth: 0,
                        }}
                      >
                        <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: 600 }}>
                          vs {oppName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#8b949e' }}>
                          {completedLabel}
                          {myScore != null && oppScore != null && (
                            <span style={{ marginLeft: 8 }}>
                              {myScore} – {oppScore} pts
                            </span>
                          )}
                        </div>
                      </div>
                      {onOpenFilmRoom && (
                        <button
                          onClick={() => onOpenFilmRoom(b)}
                          style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            color: '#f59e0b',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Review →
                        </button>
                      )}
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          )}

          {/* Stats Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {/* Total Battles */}
            <div style={{
              backgroundColor: '#161b22',
              border: `1px solid ${historyTab === 'draft' ? '#8b5cf6' : historyTab === 'training' ? '#9333ea' : '#21262d'}`,
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>
                {historyTab === 'draft' ? '🎯' : historyTab === 'training' ? '🤖' : '⚔️'}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff' }}>
                {historyTab === 'training' ? completedBattles.length : tabWins + tabLosses}
              </div>
              <div style={{ fontSize: '13px', color: '#8b949e' }}>
                {historyTab === 'draft' ? 'Draft' : historyTab === 'training' ? 'Training' : 'BaggerBomb'} Battles
              </div>
            </div>

            {/* Wins */}
            <div style={{
              backgroundColor: '#161b22',
              border: '2px solid #22c55e',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏆</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
                {tabWins}
              </div>
              <div style={{ fontSize: '13px', color: '#8b949e' }}>Wins</div>
            </div>

            {/* Losses */}
            <div style={{
              backgroundColor: '#161b22',
              border: '2px solid #ef4444',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>💀</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                {tabLosses}
              </div>
              <div style={{ fontSize: '13px', color: '#8b949e' }}>Losses</div>
            </div>
          </div>

          {/* Battle List */}
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff', marginBottom: '16px' }}>
            {historyTab === 'draft' ? 'Past Draft Battles' : historyTab === 'training' ? 'Past Training Battles' : 'Past BaggerBomb Battles'}
          </h2>

          {loadingTrainingBattles && historyTab === 'training' ? (
            <div style={{
              backgroundColor: '#161b22',
              border: '1px solid #9333ea',
              borderRadius: '12px',
              padding: '48px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'pulse 2s infinite' }}>🤖</div>
              <p style={{ color: '#8b949e', fontSize: '18px' }}>Loading training battles...</p>
            </div>
          ) : completedBattles.length === 0 ? (
            <div style={{
              backgroundColor: '#161b22',
              border: '1px solid #21262d',
              borderRadius: '12px',
              padding: '48px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>
                {historyTab === 'draft' ? '🎯' : historyTab === 'training' ? '🤖' : '🎮'}
              </div>
              <p style={{ color: '#8b949e', fontSize: '18px', marginBottom: '8px' }}>
                No {historyTab === 'draft' ? 'draft' : historyTab === 'training' ? 'training' : 'BaggerBomb'} battles yet
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                {historyTab === 'draft'
                  ? 'Start a draft battle to build your history!'
                  : historyTab === 'training'
                  ? 'Play against AI opponents to practice your strategy!'
                  : 'Create your first BaggerBomb battle to start your history!'
                }
              </p>
              <button
                onClick={onBack}
                style={{
                  backgroundColor: historyTab === 'draft' ? '#8b5cf6' : historyTab === 'training' ? '#9333ea' : '#00d9ff',
                  color: (historyTab === 'draft' || historyTab === 'training') ? '#ffffff' : '#000000',
                  fontWeight: 'bold',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {completedBattles.map((battle, index) => {
                // Draft battle card (4 players)
                if (historyTab === 'draft' && battle.finalStandings) {
                  const currentUserId = user?.odUserId || user?.username;
                  const myResult = battle.finalStandings?.find(p =>
                    p.odUserId === currentUserId
                  );
                  const won = myResult?.finalRank === 1;
                  const podium = myResult?.finalRank <= 3;

                  return (
                    <div
                      key={battle.id || index}
                      style={{
                        background: '#161b22',
                        borderLeft: won ? '4px solid #10b981' :
                                   podium ? '4px solid #f59e0b' :
                                   '4px solid #ef4444',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '0'
                      }}
                    >
                      {/* Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            background: won ? 'rgba(16, 185, 129, 0.2)' :
                                       podium ? 'rgba(245, 158, 11, 0.2)' :
                                       'rgba(239, 68, 68, 0.2)',
                            color: won ? '#10b981' :
                                  podium ? '#f59e0b' :
                                  '#ef4444'
                          }}>
                            {won ? '🏆 1ST PLACE' :
                             myResult?.finalRank === 2 ? '🥈 2ND PLACE' :
                             myResult?.finalRank === 3 ? '🥉 3RD PLACE' :
                             `${myResult?.finalRank || '?'}TH PLACE`}
                          </span>
                          <span style={{ fontSize: '16px' }}>🐍</span>
                        </div>
                        <span style={{ color: '#6e7681', fontSize: '12px' }}>
                          {battle.completedAt ? new Date(battle.completedAt).toLocaleDateString() : ''}
                        </span>
                      </div>

                      {/* Your Performance */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '12px'
                      }}>
                        <div>
                          <div style={{ color: '#8b949e', fontSize: '11px' }}>YOUR SCORE</div>
                          <div style={{
                            fontSize: '24px',
                            fontWeight: 'bold',
                            color: myResult?.finalGain >= 0 ? '#10b981' : '#ef4444'
                          }}>
                            {myResult?.finalGain >= 0 ? '+' : ''}{myResult?.finalGain?.toFixed(2)}%
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#8b949e', fontSize: '11px' }}>WINNER</div>
                          <div style={{ color: '#ffffff', fontWeight: 'bold' }}>
                            {battle.winner?.displayName || 'Unknown'}
                          </div>
                          <div style={{ color: '#10b981', fontSize: '12px' }}>
                            +{battle.winner?.finalGain?.toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      {/* All Players Summary */}
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap'
                      }}>
                        {battle.finalStandings?.map((player, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: player.finalRank === 1 ? 'rgba(16, 185, 129, 0.1)' : '#0d1117',
                              border: player.odUserId === currentUserId
                                ? '1px solid #00d9ff'
                                : '1px solid #21262d',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '11px',
                              flex: '1',
                              minWidth: '70px',
                              textAlign: 'center'
                            }}
                          >
                            <div style={{ color: '#8b949e' }}>
                              {player.finalRank === 1 ? '🥇' :
                               player.finalRank === 2 ? '🥈' :
                               player.finalRank === 3 ? '🥉' : `#${player.finalRank}`}
                            </div>
                            <div style={{
                              color: player.odUserId === currentUserId ? '#00d9ff' : '#ffffff',
                              fontWeight: 'bold'
                            }}>
                              {player.odUserId === currentUserId ? 'You' : (player.displayName?.slice(0, 6) || 'Player')}
                            </div>
                            <div style={{
                              color: player.finalGain >= 0 ? '#10b981' : '#ef4444',
                              fontSize: '10px'
                            }}>
                              {player.finalGain >= 0 ? '+' : ''}{player.finalGain?.toFixed(1)}%
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Battle Info */}
                      <div style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #21262d',
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: '#6e7681',
                        fontSize: '11px'
                      }}>
                        <span>{battle.code || 'Draft Battle'}</span>
                        <span>{battle.type === 'stocks' ? '📈 Stocks' : '🪙 Crypto'}</span>
                        <span>4-Player Draft</span>
                      </div>
                    </div>
                  );
                }

                // Training battle card (vs AI) — points-based scoring
                if (historyTab === 'training' && battle.isTrainingBattle) {
                  const isCreator = battle.creator?.odUserId === (user?.odUserId || user?.username)
                    || battle.creator?.username === user?.username;
                  const myScore = isCreator ? battle.result?.creatorScore : battle.result?.opponentScore;
                  const oppScore = isCreator ? battle.result?.opponentScore : battle.result?.creatorScore;
                  const oppName = isCreator ? (battle.opponent?.username || 'CPU Opponent') : (battle.creator?.username || 'Player');
                  const won = battle.result?.winner
                    ? didUserWin(battle)
                    : (myScore != null && oppScore != null && myScore > oppScore);
                  const completedDate = battle.completedAt || battle.timeline?.completedAt;
                  const isBaggerBombTraining = battle.type === 'baggerbomb' || battle.type === 'baggerbomb_training' || battle.type === 'baggerbomb_v4' || battle.type === 'baggerbomb_v5' || battle._v >= 3;

                  return (
                    <div
                      key={battle.id || index}
                      style={{
                        background: '#161b22',
                        borderLeft: won ? '4px solid #10b981' : '4px solid #ef4444',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '0'
                      }}
                    >
                      {/* Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            background: won ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: won ? '#10b981' : '#ef4444'
                          }}>
                            {won ? '🏆 VICTORY' : '💀 DEFEAT'}
                          </span>
                          <span style={{ fontSize: '16px' }}>🤖</span>
                        </div>
                        <span style={{ color: '#6e7681', fontSize: '12px' }}>
                          {completedDate ? new Date(completedDate).toLocaleDateString() : ''}
                        </span>
                      </div>

                      {/* Matchup */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        background: '#0d1117',
                        borderRadius: '8px',
                        padding: '12px'
                      }}>
                        {/* You */}
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ color: '#00d9ff', fontWeight: 'bold', fontSize: '14px' }}>You</div>
                          <div style={{
                            color: myScore != null ? ((myScore >= (oppScore || 0)) ? '#10b981' : '#ef4444') : '#6e7681',
                            fontSize: '20px',
                            fontWeight: 'bold'
                          }}>
                            {myScore != null ? `${myScore} pts` : '—'}
                          </div>
                        </div>

                        <div style={{ color: '#6e7681', fontSize: '18px', fontWeight: 'bold' }}>VS</div>

                        {/* AI */}
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ color: '#9333ea', fontWeight: 'bold', fontSize: '14px' }}>
                            {oppName}
                          </div>
                          <div style={{
                            color: oppScore != null ? ((oppScore >= (myScore || 0)) ? '#10b981' : '#ef4444') : '#6e7681',
                            fontSize: '20px',
                            fontWeight: 'bold'
                          }}>
                            {oppScore != null ? `${oppScore} pts` : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Battle Info */}
                      <div style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #21262d',
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: '#6e7681',
                        fontSize: '11px'
                      }}>
                        <span style={{ color: isBaggerBombTraining ? HOLO_COLORS.amber : HOLO_COLORS.purple }}>
                          {isBaggerBombTraining ? '💣 BaggerBomb Training' : 'Classic Training'}
                        </span>
                        <span>{battle.type === 'stocks' ? '📈 Stocks' : '🪙 Crypto'}</span>
                        <span>vs AI</span>
                      </div>
                    </div>
                  );
                }

                // V3/V4/V5 BaggerBomb card (points-based)
                if (battle._v === 3 || battle._v === 4 || battle._v === 5) {
                  const isCreator = battle.creator?.username === user?.username ||
                    battle.creator?.odUserId === (user?.odUserId || user?.username);
                  const won = battle.result ? (battle.result.winner === user?.username) : false;
                  const myScore = battle.result ? (isCreator ? battle.result.creatorScore : battle.result.opponentScore) : null;
                  const oppScore = battle.result ? (isCreator ? battle.result.opponentScore : battle.result.creatorScore) : null;
                  const oppName = isCreator ? (battle.opponent?.username || 'Opponent') : (battle.creator?.username || 'Opponent');
                  const completedDate = battle.completedAt || battle.timeline?.completedAt;

                  return (
                    <div
                      key={battle.id || index}
                      style={{
                        background: '#161b22',
                        borderLeft: won ? '4px solid #10b981' : '4px solid #ef4444',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '0'
                      }}
                    >
                      {/* Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            background: won ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: won ? '#10b981' : '#ef4444'
                          }}>
                            {won ? '🏆 VICTORY' : '💀 DEFEAT'}
                          </span>
                          <span style={{ fontSize: '16px' }}>💣</span>
                        </div>
                        <span style={{ color: '#6e7681', fontSize: '12px' }}>
                          {completedDate ? new Date(completedDate).toLocaleDateString() : ''}
                        </span>
                      </div>

                      {/* Matchup: You vs Opponent with points */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        background: '#0d1117',
                        borderRadius: '8px',
                        padding: '12px'
                      }}>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ color: '#00d9ff', fontWeight: 'bold', fontSize: '14px' }}>You</div>
                          <div style={{
                            color: myScore != null ? ((myScore >= (oppScore || 0)) ? '#10b981' : '#ef4444') : '#6e7681',
                            fontSize: '20px',
                            fontWeight: 'bold'
                          }}>
                            {myScore != null ? `${myScore} pts` : '—'}
                          </div>
                        </div>

                        <div style={{ color: '#6e7681', fontSize: '18px', fontWeight: 'bold' }}>VS</div>

                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '14px' }}>
                            {oppName}
                          </div>
                          <div style={{
                            color: oppScore != null ? ((oppScore >= (myScore || 0)) ? '#10b981' : '#ef4444') : '#6e7681',
                            fontSize: '20px',
                            fontWeight: 'bold'
                          }}>
                            {oppScore != null ? `${oppScore} pts` : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Battle Info */}
                      <div style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #21262d',
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: '#6e7681',
                        fontSize: '11px'
                      }}>
                        <span>BaggerBomb</span>
                        <span>{battle.timing?.tradingDays || 3} day battle</span>
                        <span>{battle.result?.margin != null ? `Margin: ${battle.result.margin} pts` : ''}</span>
                      </div>
                    </div>
                  );
                }

                // Classic battle card (2 players)
                return (
                  <BattleHistoryCard
                    key={battle.battleId || index}
                    battle={battle}
                    userId={user?.odUserId}
                    onRematch={sendRematchRequest}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BattleHistoryScreen;
