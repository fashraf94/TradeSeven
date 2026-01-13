// /src/components/Dashboard/ActiveBattlesSection.jsx
// Extracted from App.jsx - Active Battles sections (Classic 1v1, Draft, Training, Waiting)

import { motion } from 'framer-motion';
import { Swords, GraduationCap, User, Target, Clock, Copy } from 'lucide-react';
import { getUsername } from '../../utils/battleHelpers';

const ActiveBattlesSection = ({
  activeBattles,
  activeDraftBattles,
  activeTrainingBattles,
  waitingBattles,
  user,
  colors,
  setCurrentBattle,
  setCurrentDraft,
  setScreen,
  setActiveBattleId,
  copyToClipboard,
  battleTimer
}) => {
  // Helper function to calculate battle preview data for any battle
  const calculateBattlePreviewData = (battle) => {
    if (!battle) return null;
    const isCreator = getUsername(battle.creator) === user.username;
    const opponent = isCreator ? getUsername(battle.opponent) : getUsername(battle.creator);
    const myPortfolio = isCreator ? battle.creatorPortfolio : battle.opponentPortfolio;
    const theirPortfolio = isCreator ? battle.opponentPortfolio : battle.creatorPortfolio;

    if (!myPortfolio || !theirPortfolio) return null;

    let myValue = 0;
    myPortfolio.forEach(asset => {
      const shares = asset.amount / asset.price;
      myValue += shares * asset.price;
    });

    let theirValue = 0;
    theirPortfolio.forEach(asset => {
      const shares = asset.amount / asset.price;
      theirValue += shares * asset.price;
    });

    const myGain = ((myValue - 1000000) / 1000000) * 100;
    const theirGain = ((theirValue - 1000000) / 1000000) * 100;
    const isWinning = myGain > theirGain;
    const leadBy = Math.abs(myGain - theirGain);

    return { opponent, myGain, theirGain, isWinning, leadBy, myValue, theirValue };
  };

  // Calculate preview data for all active battles
  const activeBattlesWithData = activeBattles.map(battle => ({
    battle,
    previewData: calculateBattlePreviewData(battle)
  })).filter(item => item.previewData !== null);

  const hasActiveBattle = activeBattlesWithData.length > 0;

  return (
    <>
      {/* Active Battles Section - Shows ALL active battles */}
      {hasActiveBattle && (
        <div style={{ marginBottom: '24px' }}>
          {/* Section Header - Only show when multiple battles */}
          {activeBattlesWithData.length > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px'
            }}>
              <Swords style={{ height: '18px', width: '18px', color: colors.cyan }} />
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: colors.textPrimary,
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Active Battles
              </span>
              <span style={{
                background: `${colors.cyan}30`,
                color: colors.cyan,
                padding: '2px 10px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {activeBattlesWithData.length}
              </span>
            </div>
          )}

          {/* Render ALL active battle cards */}
          {activeBattlesWithData.map(({ battle, previewData }, index) => (
            <motion.div
              key={battle.id || battle.firestoreId || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              style={{
                background: colors.cardBg,
                borderRadius: '16px',
                padding: '20px 24px',
                marginBottom: index < activeBattlesWithData.length - 1 ? '12px' : 0,
                border: `1px solid ${battle.isTrainingBattle ? colors.purple + '60' : colors.border}`,
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onClick={() => {
                setCurrentBattle(battle);
                // All battles now go to 'battle' screen
                // V2 (BaggerBomb) battles are routed in the battle screen handler
                setScreen('battle');
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = battle.isTrainingBattle ? colors.purple : colors.cyan;
                e.currentTarget.style.boxShadow = `0 0 20px ${battle.isTrainingBattle ? colors.purple : colors.cyan}30`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = battle.isTrainingBattle ? colors.purple + '60' : colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Battle Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {battle.isTrainingBattle && <GraduationCap style={{ height: '16px', width: '16px', color: colors.purple }} />}
                  {battle._v === 2 && (
                    <span style={{
                      background: `${colors.purple}30`,
                      color: colors.purple,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '700'
                    }}>
                      BB
                    </span>
                  )}
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    {battle.isTrainingBattle ? 'TRAINING' : 'BATTLE'}: vs {previewData.opponent}
                  </span>
                </div>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.cyan,
                  fontFamily: "'SF Mono', 'Monaco', monospace"
                }}>
                  {battleTimer.formatTimeRemaining(battle)} left
                </span>
              </div>

              {/* Player Comparison */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}>
                {/* You */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${colors.green}30 0%, ${colors.cyan}30 100%)`,
                    border: `2px solid ${colors.green}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <User style={{ height: '20px', width: '20px', color: colors.green }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', color: colors.textSecondary }}>YOU ({user.username})</div>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: previewData.myGain >= 0 ? colors.green : colors.red
                    }}>
                      {previewData.myGain >= 0 ? '+' : ''}{previewData.myGain.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Opponent */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexDirection: 'row-reverse' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${colors.red}30 0%, ${colors.purple}30 100%)`,
                    border: `2px solid ${colors.red}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Target style={{ height: '20px', width: '20px', color: colors.red }} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', color: colors.textSecondary }}>OPPONENT</div>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: previewData.theirGain >= 0 ? colors.green : colors.red
                    }}>
                      {previewData.theirGain >= 0 ? '+' : ''}{previewData.theirGain.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{
                position: 'relative',
                height: '8px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '9999px',
                overflow: 'hidden',
                marginBottom: '12px'
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(previewData.myValue / (previewData.myValue + previewData.theirValue)) * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    height: '100%',
                    borderRadius: '9999px',
                    background: previewData.isWinning
                      ? 'linear-gradient(90deg, #4ADE80 0%, #10B981 100%)'
                      : 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)'
                  }}
                />
              </div>

              {/* Status & Button */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: previewData.isWinning ? colors.green : colors.red
                }}>
                  {previewData.isWinning ? `LEADING BY +${previewData.leadBy.toFixed(1)}%` : `TRAILING BY -${previewData.leadBy.toFixed(1)}%`}
                </span>
                <button
                  style={{
                    padding: '8px 16px',
                    background: battle.isTrainingBattle ? colors.purple : colors.cyan,
                    border: 'none',
                    borderRadius: '8px',
                    color: colors.background,
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  VIEW BATTLE
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Active Draft Battles Section */}
      {activeDraftBattles.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            color: '#10b981',
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🐍 Active Draft Battles
          </h3>

          {activeDraftBattles.map(battle => {
            // Calculate time remaining
            const endTime = battle.battleEndTime ? new Date(battle.battleEndTime) : null;
            const now = new Date();
            let timeRemaining = '';

            if (endTime) {
              const diff = endTime - now;
              const days = Math.floor(diff / (1000 * 60 * 60 * 24));
              const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

              if (days > 0) {
                timeRemaining = `${days}d ${hours}h left`;
              } else if (hours > 0) {
                timeRemaining = `${hours}h ${minutes}m left`;
              } else {
                timeRemaining = `${minutes}m left`;
              }
            }

            // Count players
            const playerCount = battle.players?.length || 4;
            const humanCount = battle.players?.filter(p => !p.isCPU).length || 1;
            const cpuCount = playerCount - humanCount;
            const currentUserId = user?.odUserId || user?.username;

            return (
              <div
                key={battle.id}
                onClick={() => {
                  setCurrentDraft(battle);
                  setScreen('draftBattle');
                }}
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
                  border: '2px solid #10b981',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Header Row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>🐍</span>
                    <div>
                      <div style={{
                        color: '#10b981',
                        fontWeight: 'bold',
                        fontSize: '16px'
                      }}>
                        {battle.code || 'Draft Battle'}
                      </div>
                      <div style={{
                        color: '#8b949e',
                        fontSize: '12px'
                      }}>
                        {battle.type === 'stocks' ? '📈 Stocks' : '🪙 Crypto'} • {playerCount} Players
                      </div>
                    </div>
                  </div>

                  {/* Time Remaining Badge */}
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    color: '#10b981',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    ⏱️ {timeRemaining}
                  </div>
                </div>

                {/* Players Row */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '12px',
                  flexWrap: 'wrap'
                }}>
                  {battle.players?.slice(0, 4).map((player, idx) => {
                    const isMe = player.odUserId === currentUserId;
                    return (
                      <div
                        key={idx}
                        style={{
                          background: isMe ? 'rgba(0, 217, 255, 0.2)' : '#21262d',
                          border: isMe ? '1px solid #00d9ff' : '1px solid #30363d',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          color: isMe ? '#00d9ff' : '#8b949e',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {player.isCPU ? '🤖' : '👤'}
                        {isMe ? 'You' : (player.displayName?.slice(0, 8) || 'Player')}
                      </div>
                    );
                  })}
                </div>

                {/* View Battle Button */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{
                    color: '#6e7681',
                    fontSize: '11px'
                  }}>
                    {humanCount} human{humanCount !== 1 ? 's' : ''} • {cpuCount} CPU{cpuCount !== 1 ? 's' : ''}
                  </div>
                  <div style={{
                    color: '#10b981',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    View Battle →
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ⭐ Active Training Battles Section (Firebase-persisted) */}
      {activeTrainingBattles.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            color: '#a855f7',
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '20px' }}>🤖</span> Training Battles
          </h3>

          {activeTrainingBattles.map(battle => {
            // Calculate time remaining
            const endTime = battle.timeline?.endDate ? new Date(battle.timeline.endDate) : null;
            const now = new Date();
            let timeRemaining = '';

            if (endTime) {
              const diff = endTime - now;
              const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

              if (hours > 0) {
                timeRemaining = `${hours}h ${minutes}m left`;
              } else if (minutes > 0) {
                timeRemaining = `${minutes}m left`;
              } else {
                timeRemaining = 'Ending soon';
              }
            }

            // Calculate current gains (simplified - uses stored values)
            const myGain = battle.player1?.percentChange || 0;
            const cpuGain = battle.player2?.percentChange || 0;
            const isWinning = myGain > cpuGain;

            return (
              <div
                key={battle.id}
                onClick={() => {
                  // Convert Firebase format to localStorage format for battle view
                  // Check if this is a BaggerBomb (V2) battle
                  const isBaggerBomb = battle._v === 2 || battle.type === 'baggerbomb';

                  const convertedBattle = {
                    id: battle.id,
                    _v: isBaggerBomb ? 2 : 1, // Preserve version for routing
                    challengeCode: 'TRAINING',

                    // V2 format: creator/opponent objects for BaggerBombBattleViewRedesign
                    creator: isBaggerBomb ? {
                      uid: battle.player1?.odUserId || user.odUserId,
                      odUserId: battle.player1?.odUserId || user.odUserId,
                      username: battle.player1?.username || user.username,
                      portfolioName: battle.player1?.portfolioName || 'Training Portfolio',
                      portfolio: battle.player1?.portfolio || [],
                      bench: battle.player1?.bench || [],
                      portfolioType: battle.player1?.portfolioType || 'baggerbomb'
                    } : undefined,
                    opponent: isBaggerBomb ? {
                      uid: 'cpu',
                      odUserId: 'cpu',
                      username: 'CPU Opponent',
                      portfolioName: battle.player2?.portfolioName || 'CPU Strategy',
                      portfolio: battle.player2?.portfolio || [],
                      bench: battle.player2?.bench || [],
                      portfolioType: 'baggerbomb'
                    } : undefined,

                    // Legacy fields for Classic view compatibility
                    creatorPortfolio: battle.player1?.portfolio || [],
                    opponentPortfolio: battle.player2?.portfolio || [],
                    portfolioName: battle.player1?.portfolioName || 'Training Portfolio',
                    portfolioType: battle.player1?.portfolioType || 'stocks',
                    status: 'active',

                    // Timeline
                    timeline: battle.timeline,
                    startDate: battle.timeline?.startDate,
                    endDate: battle.timeline?.endDate,

                    // State
                    state: battle.state,
                    startingPrices: battle.state?.startingPrices || {},

                    // BaggerBomb specific
                    thresholds: battle.thresholds || {},
                    breakouts: battle.breakouts || { creator: [], opponent: [] },
                    sessionScores: battle.sessions || {},

                    // Training flags
                    isTraining: true,
                    isTrainingBattle: true,
                    createdAt: battle.timeline?.createdAt
                  };
                  setCurrentBattle(convertedBattle);
                  setActiveBattleId(battle.id);
                  setScreen('battle');
                }}
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
                  border: '2px solid #a855f7',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Header Row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>🤖</span>
                    <div>
                      <div style={{
                        color: '#a855f7',
                        fontWeight: 'bold',
                        fontSize: '16px'
                      }}>
                        {battle.player1?.portfolioName || 'Training Battle'}
                      </div>
                      <div style={{
                        color: '#8b949e',
                        fontSize: '12px'
                      }}>
                        vs CPU Opponent • {battle.player1?.portfolioType === 'crypto' ? '🪙 Crypto' : '📈 Stocks'}
                      </div>
                    </div>
                  </div>

                  {/* Training Badge */}
                  <div style={{
                    background: 'rgba(168, 85, 247, 0.2)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    color: '#a855f7',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    TRAINING
                  </div>
                </div>

                {/* Progress Row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      background: isWinning ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      color: isWinning ? '#22c55e' : '#ef4444',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}>
                      {myGain >= 0 ? '+' : ''}{myGain.toFixed(2)}%
                    </div>
                    <span style={{ color: '#6e7681', fontSize: '12px' }}>
                      {isWinning ? 'Leading' : myGain === cpuGain ? 'Tied' : 'Behind'}
                    </span>
                  </div>

                  {/* Time Remaining */}
                  <div style={{
                    background: 'rgba(168, 85, 247, 0.2)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    color: '#a855f7',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    ⏱️ {timeRemaining}
                  </div>
                </div>

                {/* View Battle Link */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end'
                }}>
                  <div style={{
                    color: '#a855f7',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    View Battle →
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Waiting Battles - Compact */}
      {waitingBattles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{
            background: colors.cardBg,
            borderRadius: '16px',
            padding: '20px 24px',
            marginBottom: '24px',
            border: `1px solid ${colors.gold}40`
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <Clock style={{ height: '20px', width: '20px', color: colors.gold }} />
            <span style={{
              fontSize: '14px',
              fontWeight: '600',
              color: colors.gold,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Waiting for Opponent
            </span>
          </div>
          {waitingBattles.map(battle => (
            <div key={battle.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '12px',
              marginBottom: waitingBattles.indexOf(battle) < waitingBattles.length - 1 ? '8px' : 0
            }}>
              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: colors.cyan,
                fontFamily: "'SF Mono', monospace",
                letterSpacing: '3px'
              }}>
                {battle.challengeCode}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(battle.challengeCode);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: 'transparent',
                  border: `1px solid ${colors.cyan}`,
                  borderRadius: '8px',
                  color: colors.cyan,
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${colors.cyan}20`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Copy style={{ height: '14px', width: '14px' }} />
                Copy
              </button>
            </div>
          ))}
        </motion.div>
      )}
    </>
  );
};

export default ActiveBattlesSection;
