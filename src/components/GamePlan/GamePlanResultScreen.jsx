import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, TrendingUp, Shield, Zap, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Save, Clock, Home, Check } from 'lucide-react';
import { generateRecommendations, buildPortfolioFromRecommendations } from '../../services/baggerBombRecommendationEngine';
import { generateAIStrategy, generateAIPicks, getCurrentSession } from '../../services/aiStrategyService';
import { saveTemplate } from '../../services/templateService';
import { saveGamePlanNote } from '../../services/gamePlanNotesService';
import { SECTORS } from '../../constants/sectors';

const GamePlanResultScreen = ({ onBack, onComplete, onGoHome, gamePlanData, user }) => {
  const { riskStyle, selectedSectors, mustHavePicks } = gamePlanData;

  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSection, setExpandedSection] = useState('breakout');

  // AI-related state
  const [aiStrategy, setAiStrategy] = useState('');
  const [aiPicks, setAiPicks] = useState({ wildcards: [], sessionPicks: [] });
  const [loadingAI, setLoadingAI] = useState(false);

  // Template state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Notes state
  const [savingNote, setSavingNote] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  const currentSession = getCurrentSession();

  useEffect(() => {
    loadRecommendations();
  }, [riskStyle, selectedSectors]);

  // Load AI content after recommendations are ready
  useEffect(() => {
    if (recommendations && !loadingAI && !aiStrategy) {
      loadAIContent();
    }
  }, [recommendations]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);

      const recs = await generateRecommendations({
        riskStyle,
        selectedSectors,
        mustHavePicks
      });

      setRecommendations(recs);
    } catch (err) {
      console.error('Error loading recommendations:', err);
      setError('Failed to generate recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadAIContent = async () => {
    try {
      setLoadingAI(true);

      // Generate AI strategy
      const strategy = await generateAIStrategy({
        riskStyle,
        selectedSectors,
        mustHavePicks: mustHavePicks || [],
        breakoutCandidates: recommendations.breakoutCandidates,
        safePlays: recommendations.safePlays,
        cryptoRecommendation: recommendations.cryptoRecommendation,
        sectorData: {}
      });
      setAiStrategy(strategy);

      // Generate AI picks to fill remaining slots
      const userPickCount = mustHavePicks?.length || 0;
      if (userPickCount < 9) {
        const picks = await generateAIPicks({
          riskStyle,
          selectedSectors,
          mustHavePicks: mustHavePicks || [],
          allAvailableStocks: [...(recommendations.breakoutCandidates || []), ...(recommendations.safePlays || [])],
          currentSession
        });
        setAiPicks(picks);
      }

    } catch (error) {
      console.error('Error loading AI content:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleCreatePortfolio = () => {
    if (!recommendations) return;

    const portfolio = buildPortfolioFromRecommendations(recommendations);
    onComplete?.(portfolio);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      return;
    }

    try {
      setSavingTemplate(true);

      await saveTemplate({
        userId: user?.odUserId || user?.uid || 'anonymous',
        name: templateName,
        riskStyle,
        sectors: selectedSectors,
        mustHavePicks: mustHavePicks || [],
        portfolio: recommendations ? buildPortfolioFromRecommendations(recommendations) : [],
        strategyText: aiStrategy
      });

      setShowSaveModal(false);
      setTemplateName('');
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setSavingTemplate(false);
    }
  };

  // Save game plan to Notes
  const handleSaveToNotes = async () => {
    if (savingNote || savedNote) return;

    setSavingNote(true);

    try {
      const noteData = {
        riskStyle,
        selectedSectors,
        mustHavePicks: mustHavePicks || [],
        aiStrategy: aiStrategy || '',
        breakoutCandidates: recommendations?.breakoutCandidates || [],
        safePlays: recommendations?.safePlays || [],
        cryptoRecommendation: recommendations?.cryptoRecommendation || null,
        wildcards: aiPicks?.wildcards || [],
        sessionPicks: aiPicks?.sessionPicks || []
      };

      // Pass user ID directly to avoid auth.currentUser issues
      const userId = user?.odUserId || user?.uid || user?.username;
      await saveGamePlanNote(noteData, userId);
      setSavedNote(true);

      // Reset saved status after 3 seconds
      setTimeout(() => setSavedNote(false), 3000);

    } catch (error) {
      console.error('Error saving game plan:', error);
      alert('Failed to save game plan. Please try again.');
    } finally {
      setSavingNote(false);
    }
  };

  // Return to dashboard/main screen (exits the entire flow)
  const handleReturnToDashboard = () => {
    // Use onGoHome to exit the flow completely, fallback to onBack
    if (onGoHome) {
      onGoHome();
    } else {
      onBack?.();
    }
  };

  const getSectorNames = () => {
    return selectedSectors.map(id => SECTORS[id]?.name || id).join(', ');
  };

  const getRiskStyleInfo = () => {
    const styles = {
      aggressive: {
        label: 'Aggressive',
        emoji: '🚀',
        color: '#ef4444',
        description: 'High volatility, momentum-focused'
      },
      balanced: {
        label: 'Balanced',
        emoji: '⚖️',
        color: '#f59e0b',
        description: 'Growth with risk management'
      },
      conservative: {
        label: 'Conservative',
        emoji: '🛡️',
        color: '#22c55e',
        description: 'Lower risk, stable performers'
      }
    };
    return styles[riskStyle] || styles.balanced;
  };

  const styleInfo = getRiskStyleInfo();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          border: '4px solid #21262d',
          borderTopColor: '#00d9ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '24px'
        }} />
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Generating Your Game Plan</h2>
        <p style={{ color: '#8b949e', textAlign: 'center', maxWidth: '300px' }}>
          Analyzing {selectedSectors.length} sectors with {styleInfo.label.toLowerCase()} strategy...
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        padding: '20px'
      }}>
        <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Something went wrong</h2>
        <p style={{ color: '#8b949e', textAlign: 'center', marginBottom: '24px' }}>{error}</p>
        <button
          onClick={loadRecommendations}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            backgroundColor: '#00d9ff',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={18} /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d1117', color: '#ffffff' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#00d9ff',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div style={{ fontSize: '14px', color: '#8b949e' }}>Your Game Plan</div>
        <button
          onClick={loadRecommendations}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#8b949e',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '20px', paddingBottom: '140px' }}>
        {/* Strategy Summary Card */}
        <div style={{
          padding: '20px',
          backgroundColor: '#161b22',
          borderRadius: '16px',
          marginBottom: '20px',
          border: `1px solid ${styleInfo.color}40`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: `${styleInfo.color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              {styleInfo.emoji}
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
                {styleInfo.label} Game Plan
              </h2>
              <p style={{ color: '#8b949e', fontSize: '14px' }}>
                {getSectorNames()}
              </p>
            </div>
          </div>

          {/* AI Strategy Text */}
          {loadingAI ? (
            <div style={{
              padding: '16px',
              backgroundColor: '#0d1117',
              borderRadius: '12px',
              borderLeft: '3px solid #a855f7',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #21262d',
                borderTopColor: '#a855f7',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ color: '#8b949e' }}>AI is analyzing your game plan...</span>
            </div>
          ) : (
            <div style={{
              padding: '16px',
              backgroundColor: '#0d1117',
              borderRadius: '12px',
              borderLeft: '3px solid #a855f7'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Sparkles size={16} color="#a855f7" />
                <span style={{ fontWeight: '600', color: '#a855f7', fontSize: '13px' }}>
                  AI Strategy
                </span>
                <span style={{
                  padding: '2px 8px',
                  backgroundColor: '#a855f720',
                  borderRadius: '10px',
                  fontSize: '10px',
                  color: '#a855f7'
                }}>
                  CLAUDE AI
                </span>
              </div>
              <p style={{ color: '#c9d1d9', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                {aiStrategy || recommendations?.strategyText || 'Analyzing your selections...'}
              </p>
            </div>
          )}

          {/* Stats Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginTop: '16px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#00d9ff' }}>
                {recommendations?.breakoutCandidates?.length || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Breakout Picks</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>
                {recommendations?.safePlays?.length || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Safe Plays</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
                {recommendations?.totalStocksAnalyzed || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Analyzed</div>
            </div>
          </div>
        </div>

        {/* User's Must-Have Picks */}
        {mustHavePicks && mustHavePicks.length > 0 && (
          <div style={{
            backgroundColor: '#161b22',
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: '#00d9ff20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}>
                ⭐
              </div>
              <span style={{ fontWeight: '600' }}>Your Must-Have Picks</span>
              <span style={{ color: '#8b949e', fontSize: '13px' }}>({mustHavePicks.length})</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {mustHavePicks.map(pick => (
                <div
                  key={pick.symbol}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#00d9ff20',
                    border: '1px solid #00d9ff',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}
                >
                  {pick.symbol}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Wildcard Picks */}
        {aiPicks.wildcards?.length > 0 && (
          <div style={{
            backgroundColor: '#161b22',
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: '#a855f720',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Sparkles size={14} color="#a855f7" />
              </div>
              <span style={{ fontWeight: '600' }}>AI Wildcards</span>
              <span style={{
                padding: '2px 8px',
                backgroundColor: '#a855f720',
                borderRadius: '10px',
                fontSize: '10px',
                color: '#a855f7'
              }}>
                SURPRISE
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {aiPicks.wildcards.map(symbol => (
                <div
                  key={symbol}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#a855f720',
                    border: '1px solid #a855f7',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#a855f7'
                  }}
                >
                  {symbol}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session Picks */}
        {aiPicks.sessionPicks?.length > 0 && (
          <div style={{
            backgroundColor: '#161b22',
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: '#fbbf2420',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Clock size={14} color="#fbbf24" />
              </div>
              <span style={{ fontWeight: '600' }}>Session Picks</span>
              <span style={{
                padding: '2px 8px',
                backgroundColor: '#fbbf2420',
                borderRadius: '10px',
                fontSize: '10px',
                color: '#fbbf24'
              }}>
                {currentSession.name.toUpperCase()}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {aiPicks.sessionPicks.map(symbol => (
                <div
                  key={symbol}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#fbbf2420',
                    border: '1px solid #fbbf24',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#fbbf24'
                  }}
                >
                  {symbol}
                </div>
              ))}
            </div>
            {aiPicks.reasoning && (
              <p style={{ marginTop: '10px', fontSize: '12px', color: '#8b949e', fontStyle: 'italic' }}>
                {aiPicks.reasoning}
              </p>
            )}
          </div>
        )}

        {/* Breakout Candidates Section */}
        <div style={{
          backgroundColor: '#161b22',
          borderRadius: '16px',
          marginBottom: '16px',
          overflow: 'hidden'
        }}>
          <button
            onClick={() => setExpandedSection(expandedSection === 'breakout' ? null : 'breakout')}
            style={{
              width: '100%',
              padding: '16px 20px',
              backgroundColor: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              color: '#ffffff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 217, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TrendingUp size={20} color="#00d9ff" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: '600' }}>Breakout Candidates</div>
                <div style={{ fontSize: '13px', color: '#8b949e' }}>
                  High probability BaggerBomb hits
                </div>
              </div>
            </div>
            {expandedSection === 'breakout' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {expandedSection === 'breakout' && recommendations?.breakoutCandidates && (
            <div style={{ padding: '0 20px 20px' }}>
              {recommendations.breakoutCandidates.map((stock, index) => (
                <StockRecommendationCard
                  key={stock.symbol}
                  stock={stock}
                  rank={index + 1}
                  type="breakout"
                />
              ))}
              {recommendations.breakoutCandidates.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#8b949e' }}>
                  No breakout candidates found matching criteria
                </div>
              )}
            </div>
          )}
        </div>

        {/* Safe Plays Section */}
        <div style={{
          backgroundColor: '#161b22',
          borderRadius: '16px',
          marginBottom: '16px',
          overflow: 'hidden'
        }}>
          <button
            onClick={() => setExpandedSection(expandedSection === 'safe' ? null : 'safe')}
            style={{
              width: '100%',
              padding: '16px 20px',
              backgroundColor: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              color: '#ffffff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Shield size={20} color="#22c55e" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: '600' }}>Safe Plays</div>
                <div style={{ fontSize: '13px', color: '#8b949e' }}>
                  Lower bust risk, steady performers
                </div>
              </div>
            </div>
            {expandedSection === 'safe' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {expandedSection === 'safe' && recommendations?.safePlays && (
            <div style={{ padding: '0 20px 20px' }}>
              {recommendations.safePlays.map((stock, index) => (
                <StockRecommendationCard
                  key={stock.symbol}
                  stock={stock}
                  rank={index + 1}
                  type="safe"
                />
              ))}
              {recommendations.safePlays.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#8b949e' }}>
                  No safe plays found matching criteria
                </div>
              )}
            </div>
          )}
        </div>

        {/* Crypto Section */}
        <div style={{
          backgroundColor: '#161b22',
          borderRadius: '16px',
          marginBottom: '16px',
          overflow: 'hidden'
        }}>
          <button
            onClick={() => setExpandedSection(expandedSection === 'crypto' ? null : 'crypto')}
            style={{
              width: '100%',
              padding: '16px 20px',
              backgroundColor: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              color: '#ffffff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Zap size={20} color="#f59e0b" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: '600' }}>Crypto Pick</div>
                <div style={{ fontSize: '13px', color: '#8b949e' }}>
                  10% allocation recommendation
                </div>
              </div>
            </div>
            {expandedSection === 'crypto' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {expandedSection === 'crypto' && recommendations?.cryptoRecommendation && (
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                backgroundColor: '#0d1117',
                borderRadius: '12px'
              }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '18px' }}>
                    {recommendations.cryptoRecommendation.symbol}
                  </div>
                  <div style={{ color: '#8b949e', fontSize: '14px' }}>
                    {recommendations.cryptoRecommendation.name}
                  </div>
                </div>
                <div style={{
                  padding: '6px 12px',
                  backgroundColor: recommendations.cryptoRecommendation.volatility === 'high'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(34, 197, 94, 0.15)',
                  borderRadius: '6px',
                  color: recommendations.cryptoRecommendation.volatility === 'high' ? '#ef4444' : '#22c55e',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {recommendations.cryptoRecommendation.volatility === 'high' ? 'High Volatility' : 'Medium Volatility'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 20px',
        backgroundColor: '#161b22',
        borderTop: '1px solid #21262d',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Return to Dashboard Button */}
          <button
            onClick={handleReturnToDashboard}
            style={{
              flex: 1,
              padding: '14px 20px',
              backgroundColor: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '10px',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Home size={18} />
            Dashboard
          </button>

          {/* Save to Notes Button */}
          <button
            onClick={handleSaveToNotes}
            disabled={savingNote || savedNote}
            style={{
              flex: 1.5,
              padding: '14px 20px',
              backgroundColor: savedNote ? '#10b981' : '#f59e0b',
              border: 'none',
              borderRadius: '10px',
              color: '#000000',
              fontWeight: '600',
              fontSize: '14px',
              cursor: savingNote || savedNote ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              opacity: savingNote ? 0.7 : 1
            }}
          >
            {savedNote ? (
              <>
                <Check size={18} />
                Saved!
              </>
            ) : savingNote ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #000',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save to Notes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save Template Modal */}
      {showSaveModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#161b22',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>Save Game Plan</h3>

            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name (e.g., 'Aggressive Tech Play')"
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#0d1117',
                border: '1px solid #21262d',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '15px',
                marginBottom: '16px',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowSaveModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#21262d',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !templateName.trim()}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#00d9ff',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#000',
                  fontWeight: '600',
                  cursor: savingTemplate ? 'not-allowed' : 'pointer',
                  opacity: savingTemplate || !templateName.trim() ? 0.7 : 1
                }}
              >
                {savingTemplate ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper to safely render values that might be objects, strings, or numbers
const safeRender = (value, decimals = 2) => {
  if (value === null || value === undefined) return '—';

  // Handle interpretation objects like { label: 'Good', color: '#22c55e', emoji: '✅' }
  if (typeof value === 'object') {
    if (value.label) return `${value.emoji || ''} ${value.label}`.trim();
    // Handle MACD-like objects
    if (value.macd !== undefined) return value.macd?.toFixed?.(decimals) ?? '—';
    // Try to get first numeric value
    const firstValue = Object.values(value).find(v => typeof v === 'number');
    return firstValue?.toFixed?.(decimals) ?? '—';
  }

  // Handle strings (might already be formatted)
  if (typeof value === 'string') return value;

  // Handle numbers
  if (typeof value === 'number') return value.toFixed(decimals);

  return String(value);
};

// Stock Recommendation Card Component
const StockRecommendationCard = ({ stock, rank, type }) => {
  const isBreakout = type === 'breakout';

  const getScoreColor = (score) => {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#8b949e';
  };

  const getRiskColor = (risk) => {
    if (risk <= 30) return '#22c55e';
    if (risk <= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#0d1117',
      borderRadius: '12px',
      marginBottom: '12px',
      border: '1px solid #21262d'
    }}>
      {/* Header Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: isBreakout ? 'rgba(0, 217, 255, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: '700',
            color: isBreakout ? '#00d9ff' : '#22c55e'
          }}>
            #{rank}
          </div>
          <div>
            <div style={{ fontWeight: '600', fontSize: '16px' }}>{stock.symbol}</div>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>
              {stock.name || stock.symbol}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: '600' }}>
            ${stock.price?.toFixed(2) || '—'}
          </div>
          <div style={{
            fontSize: '12px',
            color: (stock.change1W || 0) >= 0 ? '#22c55e' : '#ef4444'
          }}>
            {(stock.change1W || 0) >= 0 ? '+' : ''}{(stock.change1W || 0).toFixed(1)}% (1W)
          </div>
        </div>
      </div>

      {/* Scores Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px'
      }}>
        <div style={{
          padding: '10px',
          backgroundColor: '#161b22',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            color: getScoreColor(stock.breakoutScore || 0)
          }}>
            {stock.breakoutScore || 0}
          </div>
          <div style={{ fontSize: '10px', color: '#8b949e' }}>Breakout</div>
        </div>
        <div style={{
          padding: '10px',
          backgroundColor: '#161b22',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            color: getRiskColor(stock.bustRisk || 0)
          }}>
            {stock.bustRisk || 0}
          </div>
          <div style={{ fontSize: '10px', color: '#8b949e' }}>Bust Risk</div>
        </div>
        <div style={{
          padding: '10px',
          backgroundColor: '#161b22',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#00d9ff'
          }}>
            {safeRender(stock.threshold, 1)}%
          </div>
          <div style={{ fontSize: '10px', color: '#8b949e' }}>Threshold</div>
        </div>
      </div>

      {/* Interpretation */}
      {stock.breakoutInterpretation && (
        <div style={{
          marginTop: '12px',
          padding: '10px',
          backgroundColor: 'rgba(0, 217, 255, 0.05)',
          borderRadius: '8px',
          fontSize: '12px',
          color: typeof stock.breakoutInterpretation === 'object'
            ? stock.breakoutInterpretation.color || '#8b949e'
            : '#8b949e'
        }}>
          {safeRender(stock.breakoutInterpretation)}
        </div>
      )}
    </div>
  );
};

export default GamePlanResultScreen;
