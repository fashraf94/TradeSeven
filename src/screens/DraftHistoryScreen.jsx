// /src/screens/DraftHistoryScreen.jsx

import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';

/**
 * DraftHistoryScreen - History of snake draft battles
 *
 * @param {Object} props
 * @param {Function} props.onBack - Handler to go back to dashboard
 * @param {Object} props.containerStyle - Container style from App
 */
const DraftHistoryScreen = ({
  onBack,
  containerStyle
}) => {
  const { user } = useUser();

  const [draftHistory, setDraftHistory] = useState([]);
  const [draftStats, setDraftStats] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedHistoryDraft, setSelectedHistoryDraft] = useState(null);

  const currentUserId = user?.odUserId || user?.username;

  useEffect(() => {
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const draftService = await import('../services/draftService');
        const userId = user?.odUserId || user?.username;

        const [history, stats] = await Promise.all([
          draftService.getUserDraftHistory(userId),
          draftService.getUserDraftStats(userId)
        ]);

        setDraftHistory(history || []);
        setDraftStats(stats);
      } catch (err) {
        console.error('[DraftHistoryScreen] Error loading history:', err);
        setDraftHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    if (user) {
      loadHistory();
    }
  }, [user]);

  return (
    <div style={containerStyle}>
      <div style={{ minHeight: '100vh', background: '#0d1117' }}>
        {/* Header */}
        <div style={{
          background: '#161b22',
          borderBottom: '2px solid #21262d',
          padding: '16px'
        }}>
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <button
              onClick={onBack}
              style={{
                color: '#00d9ff',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Back
            </button>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
              Draft History
            </h1>
            <div style={{ width: '60px' }}></div>
          </div>
        </div>

        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
          {/* Stats Summary */}
          {draftStats && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <div style={{
                background: '#161b22',
                border: '1px solid #8b5cf6',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#8b5cf6' }}>
                  {draftStats.totalDrafts || 0}
                </div>
                <div style={{ color: '#8b949e', fontSize: '12px' }}>Total Drafts</div>
              </div>
              <div style={{
                background: '#161b22',
                border: '1px solid #10b981',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>
                  {draftStats.multiplayerDrafts || 0}
                </div>
                <div style={{ color: '#8b949e', fontSize: '12px' }}>Multiplayer</div>
              </div>
              <div style={{
                background: '#161b22',
                border: '1px solid #f59e0b',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>
                  {draftStats.trainingDrafts || 0}
                </div>
                <div style={{ color: '#8b949e', fontSize: '12px' }}>Training</div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {historyLoading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
              Loading draft history...
            </div>
          )}

          {/* Empty State */}
          {!historyLoading && draftHistory.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              background: '#161b22',
              borderRadius: '16px',
              border: '1px solid #21262d'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <h3 style={{ color: '#ffffff', marginBottom: '8px' }}>No Drafts Yet</h3>
              <p style={{ color: '#8b949e', marginBottom: '20px' }}>
                Complete your first draft to see it here!
              </p>
              <button
                onClick={onBack}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Start a Draft
              </button>
            </div>
          )}

          {/* Draft List */}
          {!historyLoading && draftHistory.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {draftHistory.map(draft => {
                const myPlayer = draft.players?.find(p => p.odUserId === currentUserId);
                const completedDate = draft.completedAt?.toDate?.()
                  ? draft.completedAt.toDate().toLocaleDateString()
                  : draft.completedAt
                    ? new Date(draft.completedAt).toLocaleDateString()
                    : 'Unknown date';

                return (
                  <div
                    key={draft.id}
                    onClick={() => setSelectedHistoryDraft(selectedHistoryDraft?.id === draft.id ? null : draft)}
                    style={{
                      background: '#161b22',
                      border: selectedHistoryDraft?.id === draft.id
                        ? '2px solid #8b5cf6'
                        : '1px solid #21262d',
                      borderRadius: '12px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: selectedHistoryDraft?.id === draft.id ? '16px' : '0'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>
                          {draft.isTraining ? '🎯' : '👥'}
                        </span>
                        <div>
                          <div style={{ color: '#ffffff', fontWeight: '600' }}>
                            {draft.code}
                          </div>
                          <div style={{ color: '#8b949e', fontSize: '12px' }}>
                            {draft.type === 'stocks' ? '📈 Stocks' : '🪙 Crypto'} • {completedDate}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        padding: '4px 10px',
                        background: draft.isTraining
                          ? 'rgba(245, 158, 11, 0.2)'
                          : 'rgba(16, 185, 129, 0.2)',
                        border: `1px solid ${draft.isTraining ? '#f59e0b' : '#10b981'}`,
                        borderRadius: '12px',
                        color: draft.isTraining ? '#f59e0b' : '#10b981',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {draft.isTraining ? 'Training' : 'Multiplayer'}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedHistoryDraft?.id === draft.id && (
                      <div style={{
                        borderTop: '1px solid #21262d',
                        paddingTop: '16px'
                      }}>
                        <div style={{
                          color: '#8b949e',
                          fontSize: '13px',
                          marginBottom: '12px'
                        }}>
                          Your Drafted Portfolio:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {myPlayer?.picks?.map((symbol, i) => (
                            <span
                              key={i}
                              style={{
                                padding: '4px 10px',
                                background: '#0d1117',
                                border: '1px solid #21262d',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: '12px'
                              }}
                            >
                              {symbol}
                            </span>
                          ))}
                        </div>

                        <div style={{
                          color: '#8b949e',
                          fontSize: '13px',
                          marginTop: '16px',
                          marginBottom: '8px'
                        }}>
                          Players: {draft.players?.length || 0}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {draft.players?.map((player, i) => (
                            <span
                              key={i}
                              style={{
                                padding: '4px 10px',
                                background: player.odUserId === currentUserId
                                  ? 'rgba(0, 217, 255, 0.2)'
                                  : '#0d1117',
                                border: player.odUserId === currentUserId
                                  ? '1px solid #00d9ff'
                                  : '1px solid #21262d',
                                borderRadius: '6px',
                                color: player.odUserId === currentUserId
                                  ? '#00d9ff'
                                  : '#8b949e',
                                fontSize: '12px'
                              }}
                            >
                              {player.isCPU ? '🤖' : '👤'} {player.displayName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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

export default DraftHistoryScreen;
