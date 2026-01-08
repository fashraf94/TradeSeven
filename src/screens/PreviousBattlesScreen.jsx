import React from 'react';
import DesktopBackground from '../components/DesktopBackground';
import { ChevronDown, Trophy, Eye } from 'lucide-react';

const PreviousBattlesScreen = ({
  containerStyle,
  isDesktop,
  colors,
  previousBattles,
  selectedPreviousBattle,
  setSelectedPreviousBattle,
  user,
  getUsername,
  battleTimer,
  onBack,
  onViewMatchup,
}) => {
  return (
    <div style={containerStyle}>
      {/* Animated Desktop Background */}
      <DesktopBackground isDesktop={isDesktop} />

      <div style={{
        minHeight: '100vh',
        paddingBottom: '32px',
        background: colors.background,
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: `1px solid ${colors.border}`,
          marginBottom: '24px',
          background: colors.cardBg
        }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
              <button
                onClick={onBack}
                style={{
                  background: 'transparent',
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: colors.textSecondary,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.cyan;
                  e.currentTarget.style.color = colors.cyan;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.borderSubtle;
                  e.currentTarget.style.color = colors.textSecondary;
                }}
              >
                <ChevronDown style={{ height: '20px', width: '20px', transform: 'rotate(90deg)' }} />
              </button>
              <h1 style={{ fontSize: '30px', fontWeight: 'bold', margin: 0, color: colors.textPrimary }}>Previous Battles</h1>
            </div>
            <p style={{ color: colors.textSecondary, margin: 0 }}>Review your battle history</p>
          </div>
        </div>

        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          {previousBattles.length === 0 ? (
            <div style={{
              background: colors.cardBg,
              borderRadius: '12px',
              padding: '48px',
              textAlign: 'center',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              border: `1px solid ${colors.border}`
            }}>
              <Trophy style={{ height: '64px', width: '64px', color: colors.textMuted, margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: colors.textPrimary, marginBottom: '8px' }}>
                No Previous Battles
              </h3>
              <p style={{ color: colors.textSecondary }}>
                Complete some battles to see your history here!
              </p>
            </div>
          ) : selectedPreviousBattle ? (
            // Show selected battle details
            <div>
              <button
                onClick={() => setSelectedPreviousBattle(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: colors.cardBg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.cyan,
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';
                  e.currentTarget.style.borderColor = colors.cyan;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
                  e.currentTarget.style.borderColor = colors.border;
                }}
              >
                <ChevronDown style={{ height: '16px', width: '16px', transform: 'rotate(90deg)' }} />
                Back to List
              </button>

              {/* View Matchup Button */}
              <button
                onClick={() => onViewMatchup(selectedPreviousBattle)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: colors.cyan,
                  border: 'none',
                  borderRadius: '8px',
                  padding: '16px 24px',
                  marginBottom: '16px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: colors.background,
                  width: '100%',
                  boxShadow: `0 0 20px ${colors.cyan}40`,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 30px ${colors.cyan}60`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 20px ${colors.cyan}40`;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Eye style={{ height: '20px', width: '20px' }} />
                View Matchup
              </button>

              {/* Full battle details (same as completed battles card but without X button) */}
              {(() => {
                const battle = selectedPreviousBattle;
                const result = battle.result;
                if (!result) return null;

                const won = result.winner === user.username;
                const userReturn = getUsername(battle.creator) === user.username
                  ? result.creatorReturn
                  : result.opponentReturn;
                const opponentReturn = getUsername(battle.creator) === user.username
                  ? result.opponentReturn
                  : result.creatorReturn;
                const opponent = getUsername(battle.creator) === user.username
                  ? getUsername(battle.opponent)
                  : getUsername(battle.creator);
                const xpEarned = result.xpAwarded[user.username] || 0;

                return (
                  <div style={{
                    backgroundColor: colors.cardBg,
                    borderRadius: '12px',
                    padding: '24px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                    border: `2px solid ${won ? colors.green : colors.red}`
                  }}>
                    {/* Winner Announcement */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '20px'
                    }}>
                      <span style={{ fontSize: '32px' }}>
                        {won ? '🏆' : '💔'}
                      </span>
                      <span style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: won ? colors.green : colors.red
                      }}>
                        {won ? 'Victory!' : 'Defeat'}
                      </span>
                    </div>

                    {/* Opponent */}
                    <div style={{ marginBottom: '16px', fontSize: '16px', color: colors.textSecondary }}>
                      vs. <span style={{ fontWeight: '600', color: colors.textPrimary, fontSize: '18px' }}>{opponent}</span>
                    </div>

                    {/* Portfolio Name */}
                    <div style={{
                      fontSize: '14px',
                      color: colors.textSecondary,
                      marginBottom: '20px',
                      fontStyle: 'italic'
                    }}>
                      "{battle.portfolioName || 'Unnamed Portfolio'}"
                    </div>

                    {/* Returns */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '16px',
                      marginBottom: '20px'
                    }}>
                      <div style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        padding: '16px',
                        borderRadius: '8px',
                        border: `1px solid ${userReturn >= 0 ? colors.green : colors.red}`
                      }}>
                        <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px', fontWeight: '600' }}>
                          Your Return
                        </div>
                        <div style={{
                          fontSize: '28px',
                          fontWeight: 'bold',
                          color: userReturn >= 0 ? colors.green : colors.red
                        }}>
                          {userReturn >= 0 ? '+' : ''}{userReturn}%
                        </div>
                      </div>

                      <div style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        padding: '16px',
                        borderRadius: '8px',
                        border: `1px solid ${opponentReturn >= 0 ? colors.green : colors.red}`
                      }}>
                        <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px', fontWeight: '600' }}>
                          Their Return
                        </div>
                        <div style={{
                          fontSize: '28px',
                          fontWeight: 'bold',
                          color: opponentReturn >= 0 ? colors.green : colors.red
                        }}>
                          {opponentReturn >= 0 ? '+' : ''}{opponentReturn}%
                        </div>
                      </div>
                    </div>

                    {/* Margin */}
                    <div style={{
                      backgroundColor: `${won ? colors.green : colors.red}20`,
                      padding: '12px 16px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      fontSize: '16px',
                      color: won ? colors.green : colors.red,
                      fontWeight: '600',
                      textAlign: 'center'
                    }}>
                      Victory Margin: {result.margin}%
                    </div>

                    {/* XP Earned */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      padding: '16px',
                      background: battle.isTrainingBattle
                        ? `${colors.purple}20`
                        : `${colors.cyan}20`,
                      borderRadius: '8px',
                      marginBottom: '12px'
                    }}>
                      <span style={{ fontSize: '24px' }}>⭐</span>
                      <span style={{
                        fontSize: '20px',
                        fontWeight: 'bold',
                        color: battle.isTrainingBattle ? colors.purple : colors.cyan
                      }}>
                        +{xpEarned} XP Earned
                      </span>
                    </div>

                    {/* Completed Time */}
                    <div style={{
                      textAlign: 'center',
                      fontSize: '13px',
                      color: colors.textMuted,
                      marginTop: '12px'
                    }}>
                      Completed {battleTimer.formatDate(battle.completedAt || battle.archivedAt)}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            // Show list of previous battles
            <div>
              {previousBattles.map(battle => {
                const result = battle.result;
                if (!result) return null;

                const won = result.winner === user.username;

                return (
                  <button
                    key={battle.id}
                    onClick={() => setSelectedPreviousBattle(battle)}
                    style={{
                      width: '100%',
                      background: colors.cardBg,
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '12px',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                      border: `1px solid ${won ? colors.green : colors.red}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = `0 0 20px ${won ? colors.green : colors.red}30`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: colors.textPrimary
                      }}>
                        "{battle.portfolioName || 'Unnamed Portfolio'}"
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: won ? colors.green : colors.red
                      }}>
                        {won ? '🏆 Victory' : '💔 Defeat'}
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '8px' }}>
                      {battleTimer.formatDate(battle.completedAt || battle.archivedAt)}
                    </div>
                    <div style={{ fontSize: '14px', color: colors.cyan, fontWeight: '600' }}>
                      Click to view details →
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviousBattlesScreen;
