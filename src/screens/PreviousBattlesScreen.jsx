// /src/screens/PreviousBattlesScreen.jsx

import React from 'react';
import { ChevronDown, Trophy, Eye } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

/**
 * Helper to get username from player object
 */
const getUsername = (player) => {
  if (!player) return 'Unknown';
  return player.username || player.odUsername || player.displayName || 'Unknown';
};

/**
 * PreviousBattlesScreen - Archive of completed battles with detail view
 *
 * @param {Object} props
 * @param {Array} props.battles - Array of previous battles
 * @param {Object} props.selectedBattle - Currently selected battle for detail view
 * @param {Function} props.onSelectBattle - Handler to select a battle
 * @param {Function} props.onBack - Handler to go back to dashboard
 * @param {Function} props.onViewMatchup - Handler to view full battle matchup
 * @param {Object} props.battleTimer - Battle timer utilities
 * @param {Object} props.colors - Design tokens
 * @param {boolean} props.isDesktop - Whether on desktop view
 * @param {Object} props.containerStyle - Container style from App
 * @param {React.Component} props.DesktopBackground - Desktop background component
 */
const PreviousBattlesScreen = ({
  battles = [],
  selectedBattle,
  onSelectBattle,
  onBack,
  onViewMatchup,
  battleTimer,
  colors,
  isDesktop,
  containerStyle,
  DesktopBackground
}) => {
  const { user } = useUser();

  return (
    <div style={containerStyle}>
      {/* Animated Desktop Background */}
      {DesktopBackground && <DesktopBackground isDesktop={isDesktop} />}

      <div style={{
        minHeight: '100vh',
        paddingBottom: '32px',
        background: colors?.background || '#0d1117',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: `1px solid ${colors?.border || '#21262d'}`,
          marginBottom: '24px',
          background: colors?.cardBg || '#161b22'
        }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
              <button
                onClick={onBack}
                style={{
                  background: 'transparent',
                  border: `1px solid ${colors?.borderSubtle || '#30363d'}`,
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: colors?.textSecondary || '#8b949e',
                  transition: 'all 0.2s'
                }}
              >
                <ChevronDown style={{ height: '20px', width: '20px', transform: 'rotate(90deg)' }} />
              </button>
              <h1 style={{ fontSize: '30px', fontWeight: 'bold', margin: 0, color: colors?.textPrimary || '#ffffff' }}>
                Previous Battles
              </h1>
            </div>
            <p style={{ color: colors?.textSecondary || '#8b949e', margin: 0 }}>Review your battle history</p>
          </div>
        </div>

        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          {battles.length === 0 ? (
            <div style={{
              background: colors?.cardBg || '#161b22',
              borderRadius: '12px',
              padding: '48px',
              textAlign: 'center',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              border: `1px solid ${colors?.border || '#21262d'}`
            }}>
              <Trophy style={{ height: '64px', width: '64px', color: colors?.textMuted || '#6e7681', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: colors?.textPrimary || '#ffffff', marginBottom: '8px' }}>
                No Previous Battles
              </h3>
              <p style={{ color: colors?.textSecondary || '#8b949e' }}>
                Complete some battles to see your history here!
              </p>
            </div>
          ) : selectedBattle ? (
            // Show selected battle details
            <BattleDetail
              battle={selectedBattle}
              user={user}
              colors={colors}
              battleTimer={battleTimer}
              onBack={() => onSelectBattle(null)}
              onViewMatchup={() => onViewMatchup(selectedBattle)}
            />
          ) : (
            // Show list of previous battles
            <div>
              {battles.map(battle => {
                const result = battle.result;
                if (!result) return null;

                const won = result.winner === user?.username;

                return (
                  <button
                    key={battle.id}
                    onClick={() => onSelectBattle(battle)}
                    style={{
                      width: '100%',
                      background: colors?.cardBg || '#161b22',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '12px',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                      border: `1px solid ${won ? colors?.green || '#22c55e' : colors?.red || '#ef4444'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: colors?.textPrimary || '#ffffff'
                      }}>
                        "{battle.portfolioName || 'Unnamed Portfolio'}"
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: won ? colors?.green || '#22c55e' : colors?.red || '#ef4444'
                      }}>
                        {won ? '🏆 Victory' : '💔 Defeat'}
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', color: colors?.textSecondary || '#8b949e', marginBottom: '8px' }}>
                      {battleTimer?.formatDate?.(battle.completedAt || battle.archivedAt) || 'Unknown date'}
                    </div>
                    <div style={{ fontSize: '14px', color: colors?.cyan || '#00d9ff', fontWeight: '600' }}>
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

/**
 * BattleDetail - Detailed view of a selected battle
 */
const BattleDetail = ({ battle, user, colors, battleTimer, onBack, onViewMatchup }) => {
  const result = battle.result;
  if (!result) return null;

  const won = result.winner === user?.username;
  const userReturn = getUsername(battle.creator) === user?.username
    ? result.creatorReturn
    : result.opponentReturn;
  const opponentReturn = getUsername(battle.creator) === user?.username
    ? result.opponentReturn
    : result.creatorReturn;
  const opponent = getUsername(battle.creator) === user?.username
    ? getUsername(battle.opponent)
    : getUsername(battle.creator);
  const xpEarned = result.xpAwarded?.[user?.username] || 0;

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: colors?.cardBg || '#161b22',
          border: `1px solid ${colors?.border || '#21262d'}`,
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          color: colors?.cyan || '#00d9ff',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.2s'
        }}
      >
        <ChevronDown style={{ height: '16px', width: '16px', transform: 'rotate(90deg)' }} />
        Back to List
      </button>

      {/* View Matchup Button */}
      <button
        onClick={onViewMatchup}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: colors?.cyan || '#00d9ff',
          border: 'none',
          borderRadius: '8px',
          padding: '16px 24px',
          marginBottom: '16px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: '600',
          color: colors?.background || '#0d1117',
          width: '100%',
          boxShadow: `0 0 20px ${colors?.cyan || '#00d9ff'}40`,
          transition: 'all 0.2s'
        }}
      >
        <Eye style={{ height: '20px', width: '20px' }} />
        View Matchup
      </button>

      {/* Full battle details */}
      <div style={{
        backgroundColor: colors?.cardBg || '#161b22',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
        border: `2px solid ${won ? colors?.green || '#22c55e' : colors?.red || '#ef4444'}`
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
            color: won ? colors?.green || '#22c55e' : colors?.red || '#ef4444'
          }}>
            {won ? 'Victory!' : 'Defeat'}
          </span>
        </div>

        {/* Opponent */}
        <div style={{ marginBottom: '16px', fontSize: '16px', color: colors?.textSecondary || '#8b949e' }}>
          vs. <span style={{ fontWeight: '600', color: colors?.textPrimary || '#ffffff', fontSize: '18px' }}>{opponent}</span>
        </div>

        {/* Portfolio Name */}
        <div style={{
          fontSize: '14px',
          color: colors?.textSecondary || '#8b949e',
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
            border: `1px solid ${userReturn >= 0 ? colors?.green || '#22c55e' : colors?.red || '#ef4444'}`
          }}>
            <div style={{ fontSize: '12px', color: colors?.textSecondary || '#8b949e', marginBottom: '6px', fontWeight: '600' }}>
              Your Return
            </div>
            <div style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: userReturn >= 0 ? colors?.green || '#22c55e' : colors?.red || '#ef4444'
            }}>
              {userReturn >= 0 ? '+' : ''}{userReturn}%
            </div>
          </div>

          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            padding: '16px',
            borderRadius: '8px',
            border: `1px solid ${opponentReturn >= 0 ? colors?.green || '#22c55e' : colors?.red || '#ef4444'}`
          }}>
            <div style={{ fontSize: '12px', color: colors?.textSecondary || '#8b949e', marginBottom: '6px', fontWeight: '600' }}>
              Their Return
            </div>
            <div style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: opponentReturn >= 0 ? colors?.green || '#22c55e' : colors?.red || '#ef4444'
            }}>
              {opponentReturn >= 0 ? '+' : ''}{opponentReturn}%
            </div>
          </div>
        </div>

        {/* Margin */}
        <div style={{
          backgroundColor: `${won ? colors?.green || '#22c55e' : colors?.red || '#ef4444'}20`,
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '16px',
          color: won ? colors?.green || '#22c55e' : colors?.red || '#ef4444',
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
            ? `${colors?.purple || '#8b5cf6'}20`
            : `${colors?.cyan || '#00d9ff'}20`,
          borderRadius: '8px',
          marginBottom: '12px'
        }}>
          <span style={{ fontSize: '24px' }}>⭐</span>
          <span style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: battle.isTrainingBattle ? colors?.purple || '#8b5cf6' : colors?.cyan || '#00d9ff'
          }}>
            +{xpEarned} XP Earned
          </span>
        </div>

        {/* Completed Time */}
        <div style={{
          textAlign: 'center',
          fontSize: '13px',
          color: colors?.textMuted || '#6e7681',
          marginTop: '12px'
        }}>
          Completed {battleTimer?.formatDate?.(battle.completedAt || battle.archivedAt) || 'Unknown date'}
        </div>
      </div>
    </div>
  );
};

export default PreviousBattlesScreen;
