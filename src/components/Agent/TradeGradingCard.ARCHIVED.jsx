import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck } from 'lucide-react';
import { submitDailyGrades } from '../../services/agentService';

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const GRADE_OPTIONS = [
  { key: 'good_call', label: 'Good Call', color: '#10b981' },
  { key: 'bad_read', label: 'Bad Read', color: '#ef4444' },
  { key: 'right_idea_bad_timing', label: 'Right Idea, Bad Timing', color: '#f59e0b' },
  { key: 'no_opinion', label: 'No Opinion', color: '#6b7280' },
];

const TradeGradingCard = ({ battle, tokens }) => {
  const [grades, setGrades] = useState({}); // { tradeIndex: 'good_call' }
  const [notes, setNotes] = useState({}); // { tradeIndex: 'note text' }
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Determine if we're in the grading window (4:00-4:30 PM ET, weekday)
  const { inWindow, todayStr, todayTrades } = useMemo(() => {
    const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const etDate = new Date(nowET);
    const hour = etDate.getHours();
    const minute = etDate.getMinutes();
    const day = etDate.getDay(); // 0=Sun, 6=Sat
    const isWeekday = day >= 1 && day <= 5;
    // Window: 4:00 PM to 4:30 PM ET (extended from 4:15 to give more time)
    const inGradingWindow = isWeekday && hour === 16 && minute <= 30;

    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Find today's trades by matching the current trading day
    const tradingDays = battle?.timing?.tradingDays || [];
    const todayISO = dateStr;
    const currentTradingDay = tradingDays.findIndex(d => d === todayISO) + 1;
    const trades = (battle?.trades || []).filter(t => t.swapDay === currentTradingDay);

    // Check if already graded
    const alreadyGraded = battle?.dailyGrades?.[dateStr];

    return {
      inWindow: inGradingWindow && !alreadyGraded,
      todayStr: dateStr,
      todayTrades: trades,
    };
  }, [battle]);

  if (!inWindow || todayTrades.length === 0 || submitted) return null;

  const handleGrade = (tradeIndex, grade) => {
    setGrades(prev => ({ ...prev, [tradeIndex]: grade }));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const gradeEntries = todayTrades.map((trade, i) => ({
        tradeIndex: i,
        symbolOut: trade.symbolOut,
        symbolIn: trade.symbolIn,
        grade: grades[i] || 'no_opinion',
        note: notes[i] || null,
      }));
      await submitDailyGrades(battle.id, todayStr, gradeEntries);
      setSubmitted(true);
    } catch (err) {
      console.error('[TradeGrading] Submit failed:', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const accentColor = tokens.purple || '#8b5cf6';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: '14px',
        background: tokens.bgCard,
        border: `1px solid ${hexToRgba(accentColor, 0.2)}`,
        borderLeft: `3px solid ${accentColor}`,
        padding: '14px 16px',
        boxShadow: tokens.obsidianShadow,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <ClipboardCheck size={14} color={accentColor} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Grade Today's Trades
        </span>
      </div>

      {/* Trades */}
      {todayTrades.map((trade, i) => (
        <div key={i} style={{
          padding: '10px 0',
          borderBottom: i < todayTrades.length - 1 ? `0.5px solid ${tokens.borderDefault}` : 'none',
        }}>
          {/* Trade info */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: tokens.textPrimary }}>
              {trade.symbolOut} → {trade.symbolIn} ({trade.tier})
            </span>
            <span style={{
              fontSize: '12px', fontWeight: 700, fontFamily: 'monospace',
              color: (trade.lockedGainPct || 0) >= 0 ? '#10b981' : '#ef4444',
            }}>
              {(trade.lockedGainPct || 0) >= 0 ? '+' : ''}{(trade.lockedGainPct || 0).toFixed(1)}%
            </span>
          </div>

          {/* Grade buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
            {GRADE_OPTIONS.map(opt => {
              const isSelected = grades[i] === opt.key;
              return (
                <motion.button
                  key={opt.key}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleGrade(i, opt.key)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '16px',
                    border: isSelected ? `1.5px solid ${opt.color}` : `1px solid ${tokens.borderDefault}`,
                    background: isSelected ? hexToRgba(opt.color, 0.12) : 'transparent',
                    color: isSelected ? opt.color : tokens.textMuted,
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {opt.label}
                </motion.button>
              );
            })}
          </div>

          {/* Optional note */}
          <input
            type="text"
            value={notes[i] || ''}
            onChange={e => setNotes(prev => ({ ...prev, [i]: e.target.value }))}
            placeholder="Optional note..."
            maxLength={100}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: '8px',
              border: `1px solid ${tokens.borderDefault}`,
              background: 'transparent',
              color: tokens.textSecondary,
              fontSize: '11px',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      ))}

      {/* Submit */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: '10px',
          border: 'none',
          background: accentColor,
          color: '#fff',
          fontSize: '13px',
          fontWeight: 700,
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.6 : 1,
          marginTop: '10px',
          fontFamily: 'inherit',
        }}
      >
        {submitting ? 'Submitting...' : 'Submit Grades'}
      </motion.button>
      <p style={{ fontSize: '10px', color: tokens.textFaint, textAlign: 'center', margin: '6px 0 0' }}>
        Your grades will be included in the agent's evening review.
      </p>
    </motion.div>
  );
};

export default TradeGradingCard;
