// src/components/GamePlan/NotesTab.jsx
// Displays saved game plan notes

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  TrendingUp,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { getGamePlanNotes, deleteGamePlanNote } from '../../services/gamePlanNotesService';
import { useUser } from '../../contexts';

const SECTOR_COLORS = {
  XLK: '#00d9ff',
  XLV: '#f472b6',
  XLF: '#10b981',
  XLE: '#f59e0b',
  XLY: '#8b5cf6',
  XLP: '#06b6d4',
  XLI: '#6366f1',
  XLB: '#ec4899',
  XLU: '#eab308',
  XLRE: '#14b8a6',
  XLC: '#f97316'
};

const RISK_STYLES = {
  aggressive: { label: 'Aggressive', color: '#ef4444', emoji: '🔥' },
  balanced: { label: 'Balanced', color: '#f59e0b', emoji: '⚖️' },
  conservative: { label: 'Conservative', color: '#3b82f6', emoji: '🛡️' }
};

// Accept user prop for backwards compatibility, but prefer context
const NotesTab = ({ user: userProp }) => {
  const { user: contextUser, getUserId } = useUser();
  const user = userProp || contextUser; // Prefer prop if passed, fall back to context

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedNote, setExpandedNote] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // Get user ID - use hook if available, else derive from user object
  const userId = getUserId() || user?.odUserId || user?.uid || user?.username;

  useEffect(() => {
    loadNotes();
  }, [userId]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedNotes = await getGamePlanNotes(userId, 20);
      setNotes(fetchedNotes);
    } catch (err) {
      console.error('Error loading notes:', err);
      setError('Failed to load saved game plans');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (noteId, e) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this game plan?')) {
      return;
    }

    setDeleting(noteId);

    try {
      await deleteGamePlanNote(noteId, userId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (err) {
      console.error('Error deleting note:', err);
      alert('Failed to delete game plan');
    } finally {
      setDeleting(null);
    }
  };

  const toggleExpand = (noteId) => {
    setExpandedNote(expandedNote === noteId ? null : noteId);
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown date';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        color: '#8b949e'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #21262d',
          borderTopColor: '#00d9ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <span>Loading saved game plans...</span>
        <style>
          {`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        color: '#f87171'
      }}>
        <AlertCircle size={40} style={{ marginBottom: '16px' }} />
        <span>{error}</span>
        <button
          onClick={loadNotes}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            backgroundColor: '#21262d',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        color: '#8b949e',
        textAlign: 'center'
      }}>
        <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <h3 style={{ margin: '0 0 8px', color: '#fff', fontWeight: '600' }}>
          No Saved Game Plans
        </h3>
        <p style={{ margin: 0, fontSize: '14px', maxWidth: '280px' }}>
          Create a BaggerBomb game plan and save it here for future reference.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#fff'
        }}>
          <FileText size={20} color="#f59e0b" />
          Saved Game Plans
        </h2>
        <span style={{ color: '#8b949e', fontSize: '13px' }}>
          {notes.length} saved
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {notes.map((note) => {
          const isExpanded = expandedNote === note.id;
          const riskInfo = RISK_STYLES[note.riskStyle] || RISK_STYLES.balanced;

          return (
            <div
              key={note.id}
              style={{
                backgroundColor: '#161b22',
                border: '1px solid #21262d',
                borderRadius: '12px',
                overflow: 'hidden'
              }}
            >
              {/* Header - Always Visible */}
              <div
                onClick={() => toggleExpand(note.id)}
                style={{
                  padding: '14px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: `${riskInfo.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}>
                    {riskInfo.emoji}
                  </div>
                  <div>
                    <div style={{
                      fontWeight: '600',
                      color: '#fff',
                      fontSize: '14px',
                      marginBottom: '2px'
                    }}>
                      {riskInfo.label} Strategy
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#8b949e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <Clock size={12} />
                      {formatDate(note.createdAt)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Sector Pills */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {note.selectedSectors?.slice(0, 3).map(sector => (
                      <div
                        key={sector}
                        style={{
                          padding: '2px 8px',
                          backgroundColor: `${SECTOR_COLORS[sector] || '#8b949e'}20`,
                          borderRadius: '10px',
                          fontSize: '10px',
                          fontWeight: '600',
                          color: SECTOR_COLORS[sector] || '#8b949e'
                        }}
                      >
                        {sector}
                      </div>
                    ))}
                    {note.selectedSectors?.length > 3 && (
                      <div style={{
                        padding: '2px 6px',
                        fontSize: '10px',
                        color: '#8b949e'
                      }}>
                        +{note.selectedSectors.length - 3}
                      </div>
                    )}
                  </div>

                  {isExpanded ? <ChevronUp size={18} color="#8b949e" /> : <ChevronDown size={18} color="#8b949e" />}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{
                  padding: '0 16px 16px',
                  borderTop: '1px solid #21262d'
                }}>
                  {/* AI Strategy */}
                  {note.aiStrategy && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#0d1117',
                      borderRadius: '8px',
                      marginTop: '12px',
                      borderLeft: '3px solid #a855f7'
                    }}>
                      <div style={{
                        fontSize: '11px',
                        color: '#a855f7',
                        fontWeight: '600',
                        marginBottom: '6px'
                      }}>
                        AI STRATEGY
                      </div>
                      <p style={{
                        margin: 0,
                        color: '#c9d1d9',
                        fontSize: '13px',
                        lineHeight: '1.5'
                      }}>
                        {note.aiStrategy}
                      </p>
                    </div>
                  )}

                  {/* Must-Have Picks */}
                  {note.mustHavePicks?.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{
                        fontSize: '11px',
                        color: '#8b949e',
                        fontWeight: '600',
                        marginBottom: '8px'
                      }}>
                        MUST-HAVE PICKS
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {note.mustHavePicks.map(pick => (
                          <span
                            key={pick.symbol}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: '#21262d',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#fff'
                            }}
                          >
                            {pick.symbol}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Breakout Candidates */}
                  {note.breakoutCandidates?.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{
                        fontSize: '11px',
                        color: '#10b981',
                        fontWeight: '600',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <TrendingUp size={12} />
                        BREAKOUT CANDIDATES
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {note.breakoutCandidates.map(stock => (
                          <span
                            key={stock.symbol}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: '#10b98120',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#10b981'
                            }}
                          >
                            {stock.symbol}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Safe Plays */}
                  {note.safePlays?.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{
                        fontSize: '11px',
                        color: '#3b82f6',
                        fontWeight: '600',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Target size={12} />
                        SAFE PLAYS
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {note.safePlays.map(stock => (
                          <span
                            key={stock.symbol}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: '#3b82f620',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#3b82f6'
                            }}
                          >
                            {stock.symbol}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Crypto Pick */}
                  {note.cryptoRecommendation && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{
                        fontSize: '11px',
                        color: '#f59e0b',
                        fontWeight: '600',
                        marginBottom: '8px'
                      }}>
                        CRYPTO PICK
                      </div>
                      <span style={{
                        padding: '4px 10px',
                        backgroundColor: '#f59e0b20',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#f59e0b'
                      }}>
                        {note.cryptoRecommendation.symbol}
                      </span>
                    </div>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDelete(note.id, e)}
                    disabled={deleting === note.id}
                    style={{
                      marginTop: '16px',
                      padding: '10px 16px',
                      backgroundColor: '#21262d',
                      border: '1px solid #f8717130',
                      borderRadius: '8px',
                      color: '#f87171',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: deleting === note.id ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      width: '100%',
                      opacity: deleting === note.id ? 0.6 : 1
                    }}
                  >
                    <Trash2 size={14} />
                    {deleting === note.id ? 'Deleting...' : 'Delete Game Plan'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NotesTab;
