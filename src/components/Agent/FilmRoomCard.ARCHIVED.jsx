import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { addDirective, appendBattleLedger, updateReviewDecision } from '../../services/agentService';

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const GRADE_COLORS = { A: '#10b981', B: '#5eead4', C: '#f59e0b', D: '#ef4444', F: '#ef4444' };

const FilmRoomCard = ({ battle, agentId, tokens }) => {
  const [expandedSection, setExpandedSection] = useState(null);

  // Persisted review decisions from Firestore (survives re-renders/navigation)
  const reviewDecisions = battle?.reviewDecisions || {};
  const getRuleId = (reviewDate, index) => `${reviewDate}_rule_${index}`;

  // Find latest review
  const review = useMemo(() => {
    const reviews = battle?.dailyReviews || [];
    if (reviews.length === 0) return null;
    // Return the most recent review
    return reviews[reviews.length - 1];
  }, [battle?.dailyReviews]);

  if (!review) return null;

  const gradeColor = GRADE_COLORS[review.selfGrade] || tokens.textMuted;

  const handleAcceptRule = async (rule, index) => {
    const ruleId = getRuleId(review.date, index);
    if (reviewDecisions[ruleId] || !agentId) return;
    try {
      await addDirective(agentId, { text: rule.text, source: 'batch_review' });
      await updateReviewDecision(battle.id, ruleId, 'accepted');
      await appendBattleLedger(battle.id, {
        type: 'rule_accepted',
        details: { ruleText: rule.text, source: 'batch_review', reviewDate: review.date },
      });
    } catch (err) {
      console.error('[FilmRoom] Failed to accept rule:', err.message);
    }
  };

  const handleRejectRule = async (rule, index) => {
    const ruleId = getRuleId(review.date, index);
    if (reviewDecisions[ruleId]) return;
    try {
      await updateReviewDecision(battle.id, ruleId, 'rejected');
      await appendBattleLedger(battle.id, {
        type: 'rule_rejected',
        details: { ruleText: rule.text, source: 'batch_review', reviewDate: review.date },
      });
    } catch (err) {
      console.error('[FilmRoom] Failed to reject rule:', err.message);
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: '14px',
        background: tokens.bgCard,
        border: `1px solid ${tokens.borderDefault}`,
        boxShadow: tokens.obsidianShadow,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: `0.5px solid ${tokens.borderDefault}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Film size={14} color={tokens.purple || '#8b5cf6'} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: tokens.textPrimary }}>
            Film Room — Day {review.tradingDay}
          </span>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: '10px',
          fontSize: '12px', fontWeight: 800,
          color: gradeColor, background: hexToRgba(gradeColor, 0.12),
          fontFamily: 'monospace',
        }}>
          {review.selfGrade}
        </span>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {/* Day Summary */}
        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={() => toggleSection('summary')}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px', width: '100%',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: '10px', fontWeight: 600, color: tokens.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.3px', fontFamily: 'inherit',
            }}
          >
            Day Summary
            {expandedSection === 'summary' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <AnimatePresence>
            {expandedSection === 'summary' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <p style={{ fontSize: '12px', color: tokens.textSecondary, lineHeight: '1.5', margin: '6px 0 0' }}>
                  {review.daySummary}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Strategy Analysis */}
        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={() => toggleSection('strategy')}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px', width: '100%',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: '10px', fontWeight: 600, color: tokens.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.3px', fontFamily: 'inherit',
            }}
          >
            Strategy Analysis
            {expandedSection === 'strategy' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <AnimatePresence>
            {expandedSection === 'strategy' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <p style={{ fontSize: '12px', color: tokens.textSecondary, lineHeight: '1.5', margin: '6px 0 0' }}>
                  {review.strategyAnalysis}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Counterfactuals */}
        {review.counterfactuals?.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' }}>
              Veto Results
            </div>
            {review.counterfactuals.map((cf, i) => {
              const isGood = cf.outcome === 'avoided_loss';
              const color = isGood ? '#10b981' : '#f59e0b';
              return (
                <div key={i} style={{
                  padding: '6px 10px', borderRadius: '8px', marginBottom: '4px',
                  background: hexToRgba(color, 0.06),
                  borderLeft: `2px solid ${color}`,
                }}>
                  <span style={{ fontSize: '12px', color: tokens.textSecondary }}>
                    {cf.summary}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Proposed Rules */}
        {review.proposedRules?.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' }}>
              Proposed Playbook Rules
            </div>
            {review.proposedRules.map((rule, i) => {
              const ruleId = getRuleId(review.date, i);
              const resolved = reviewDecisions[ruleId];
              return (
                <div key={i} style={{
                  padding: '10px 12px', borderRadius: '10px', marginBottom: '6px',
                  background: hexToRgba(tokens.purple || '#8b5cf6', 0.06),
                  border: `1px solid ${hexToRgba(tokens.purple || '#8b5cf6', 0.15)}`,
                }}>
                  <div style={{ fontSize: '12px', color: tokens.textPrimary, fontWeight: 600, marginBottom: '4px' }}>
                    "{rule.text}"
                  </div>
                  <div style={{ fontSize: '11px', color: tokens.textFaint, marginBottom: '8px' }}>
                    {rule.rationale}
                  </div>
                  {resolved ? (
                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      color: resolved === 'accepted' ? '#10b981' : tokens.textFaint,
                    }}>
                      {resolved === 'accepted' ? '✓ Added to directives' : '✗ Rejected'}
                    </span>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAcceptRule(rule, i)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '3px',
                          padding: '5px 12px', borderRadius: '8px', border: 'none',
                          background: hexToRgba('#10b981', 0.12), color: '#10b981',
                          fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <Check size={11} /> Accept
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleRejectRule(rule, i)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '3px',
                          padding: '5px 12px', borderRadius: '8px', border: 'none',
                          background: hexToRgba('#ef4444', 0.12), color: '#ef4444',
                          fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <X size={11} /> Reject
                      </motion.button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Grade rationale */}
        {review.selfGradeRationale && (
          <div style={{ fontSize: '11px', color: tokens.textFaint, marginBottom: '6px' }}>
            {review.selfGradeRationale}
          </div>
        )}

        {/* Lesson learned */}
        {review.lessonLearned && (
          <p style={{
            fontSize: '12px', color: tokens.textMuted, fontStyle: 'italic',
            lineHeight: '1.4', margin: 0, paddingTop: '6px',
            borderTop: `0.5px solid ${tokens.borderDefault}`,
          }}>
            {review.lessonLearned}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default FilmRoomCard;
