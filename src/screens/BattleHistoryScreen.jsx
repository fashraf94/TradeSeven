// /src/screens/BattleHistoryScreen.jsx

import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';

/**
 * BattleHistoryScreen - View all battle history
 * Extracted from App.jsx Phase 6
 */
const BattleHistoryScreen = ({
  onBack,
  onNavigate,
  colors,
  containerStyle,
  // Battle data
  previousBattles = [],
  completedDraftBattles = [],
  completedTrainingBattles = [],
  loadingTrainingBattles = false
}) => {
  const { user } = useUser();
  const [historyTab, setHistoryTab] = useState('classic');

  // Get completed battles based on tab
  const allCompletedClassicBattles = previousBattles || [];
  const classicBattles = allCompletedClassicBattles.filter(b => b.isDraft !== true && b.battleType !== 'baggerbomb_training');

  // Select battles based on current tab
  const completedBattles = historyTab === 'draft'
    ? completedDraftBattles
    : historyTab === 'training'
      ? completedTrainingBattles
      : classicBattles;

  // Stats for the current tab
  const tabWins = completedBattles.filter(b => b.won === true || b.result?.winner === user?.username).length;
  const tabLosses = completedBattles.filter(b => b.won === false || (b.result && b.result.winner !== user?.username)).length;

  return (
    <div style={containerStyle}>
      <div style={{ minHeight: '100vh', background: colors?.background || '#0d1117' }}>
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
              Classic Mode
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
                {historyTab === 'draft' ? 'Draft' : historyTab === 'training' ? 'Training' : 'Classic'} Battles
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
            {historyTab === 'draft' ? 'Past Draft Battles' : historyTab === 'training' ? 'Past Training Battles' : 'Past Classic Battles'}
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
                No {historyTab === 'draft' ? 'draft' : historyTab === 'training' ? 'training' : 'classic'} battles yet
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                {historyTab === 'draft'
                  ? 'Start a draft battle to build your history!'
                  : historyTab === 'training'
                    ? 'Play against AI opponents to practice your strategy!'
                    : 'Create your first classic battle to start your history!'
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
                  const myResult = battle.finalStandings?.find(p => p.odUserId === currentUserId);
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
                        padding: '16px'
                      }}
                    >
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

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <div style={{ color: '#8b949e', fontSize: '11px' }}>YOUR GAIN</div>
                          <div style={{
                            fontSize: '24px',
                            fontWeight: 'bold',
                            color: (myResult?.finalGain || 0) >= 0 ? '#10b981' : '#ef4444'
                          }}>
                            {(myResult?.finalGain || 0) >= 0 ? '+' : ''}{(myResult?.finalGain || 0).toFixed(2)}%
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#8b949e', fontSize: '11px' }}>WINNER</div>
                          <div style={{ color: '#ffffff', fontWeight: 'bold' }}>
                            {battle.winner?.displayName || 'Unknown'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Training/Classic battle card
                const battleWon = battle.won === true || battle.result?.winner === user?.username;

                return (
                  <div
                    key={battle.id || index}
                    style={{
                      background: '#161b22',
                      borderLeft: battleWon ? '4px solid #10b981' : '4px solid #ef4444',
                      borderRadius: '12px',
                      padding: '16px'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px'
                    }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        background: battleWon ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: battleWon ? '#10b981' : '#ef4444'
                      }}>
                        {battleWon ? '🏆 WIN' : '💀 LOSS'}
                      </span>
                      <span style={{ color: '#6e7681', fontSize: '12px' }}>
                        {battle.completedAt ? new Date(battle.completedAt).toLocaleDateString() : ''}
                      </span>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ color: '#ffffff', fontWeight: '600' }}>
                          vs {battle.opponent || battle.creator || 'Unknown'}
                        </div>
                        <div style={{ color: '#8b949e', fontSize: '12px' }}>
                          {battle.portfolioName || 'Portfolio Battle'}
                        </div>
                      </div>
                      <div style={{
                        color: (battle.myGain || 0) >= 0 ? '#10b981' : '#ef4444',
                        fontWeight: 'bold',
                        fontSize: '18px'
                      }}>
                        {(battle.myGain || 0) >= 0 ? '+' : ''}{(battle.myGain || 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
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
