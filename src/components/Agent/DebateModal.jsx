import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Loader2 } from 'lucide-react';
import CenteredModal from '../shared/CenteredModal';
import { appendBattleLedger } from '../../services/agentService';
import { getAuth } from 'firebase/auth';

const STANCES = [
  { key: 'overvalued', label: 'Overvalued' },
  { key: 'bad_timing', label: 'Bad Timing' },
  { key: 'wrong_sector', label: 'Wrong Sector' },
  { key: 'hold_longer', label: 'Hold Longer' },
  { key: 'cut_losses', label: 'Cut Losses' },
  { key: 'earnings_risk', label: 'Earnings Risk' },
];

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const DebateModal = ({ isOpen, onClose, battleId, targetSymbol, tokens }) => {
  const [stance, setStance] = useState(null);
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | loading | response
  const [agentResult, setAgentResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!stance || !battleId || !targetSymbol) return;
    setPhase('loading');
    setError(null);

    try {
      const idToken = await getAuth().currentUser.getIdToken();
      const res = await fetch('/api/agent/debate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          battleId,
          targetSymbol,
          userStance: stance,
          additionalContext: note || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setAgentResult(data);
      setPhase('response');
    } catch (err) {
      console.error('[Debate] Failed:', err.message);
      setError('Failed to get agent response. Try again.');
      setPhase('idle');
    }
  };

  const handleOutcome = async (outcome) => {
    try {
      await appendBattleLedger(battleId, {
        type: 'debate',
        details: {
          outcome,
          targetSymbol,
          userStance: stance,
          agentConviction: agentResult?.conviction || 0,
          agentSuggestedAction: agentResult?.suggestedAction || null,
        },
      });
    } catch (err) {
      console.error('[Debate] Ledger write failed:', err.message);
    }
    // Reset and close
    setPhase('idle');
    setStance(null);
    setNote('');
    setAgentResult(null);
    onClose();
  };

  const handleClose = () => {
    setPhase('idle');
    setStance(null);
    setNote('');
    setAgentResult(null);
    setError(null);
    onClose();
  };

  return (
    <CenteredModal isOpen={isOpen} onClose={handleClose} title={`Challenge: ${targetSymbol}`}>
      <div style={{ padding: '0 20px 20px', overflowY: 'auto', maxHeight: '60vh' }}>
        {phase === 'idle' && (
          <>
            <div style={{ fontSize: '12px', color: tokens.textMuted, marginBottom: '12px' }}>
              What's your concern?
            </div>

            {/* Stance pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
              {STANCES.map(s => (
                <motion.button
                  key={s.key}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStance(s.key)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '20px',
                    border: stance === s.key
                      ? `1.5px solid ${tokens.teal}`
                      : `1px solid ${tokens.borderDefault}`,
                    background: stance === s.key ? hexToRgba(tokens.teal, 0.12) : 'transparent',
                    color: stance === s.key ? tokens.teal : tokens.textSecondary,
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {s.label}
                </motion.button>
              ))}
            </div>

            {/* Optional note */}
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note (optional)..."
              maxLength={200}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: `1px solid ${tokens.borderDefault}`,
                background: tokens.bgCard,
                color: tokens.textPrimary,
                fontSize: '12px',
                fontFamily: 'inherit',
                resize: 'none',
                height: '60px',
                marginBottom: '12px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {error && (
              <div style={{ fontSize: '11px', color: '#ef4444', marginBottom: '8px' }}>{error}</div>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={!stance}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                border: 'none',
                background: stance ? tokens.teal : hexToRgba(tokens.teal, 0.3),
                color: stance ? '#000' : tokens.textFaint,
                fontSize: '13px',
                fontWeight: 700,
                cursor: stance ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              Submit Challenge
            </motion.button>
          </>
        )}

        {phase === 'loading' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '30px 0', gap: '12px',
          }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <Loader2 size={24} color={tokens.teal} />
            </motion.div>
            <span style={{ fontSize: '12px', color: tokens.textMuted }}>
              Agent is formulating a response...
            </span>
          </div>
        )}

        {phase === 'response' && agentResult && (
          <>
            {/* Agent response */}
            <div style={{
              padding: '12px',
              borderRadius: '10px',
              background: hexToRgba(tokens.teal, 0.06),
              border: `1px solid ${hexToRgba(tokens.teal, 0.15)}`,
              marginBottom: '12px',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: tokens.teal, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' }}>
                Agent Response
              </div>
              <p style={{ fontSize: '13px', color: tokens.textPrimary, lineHeight: '1.5', margin: 0 }}>
                {agentResult.agentResponse}
              </p>
            </div>

            {/* Indicators + strategy */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
              {(agentResult.citedIndicators || []).map((ind, i) => (
                <span key={i} style={{
                  padding: '2px 8px', borderRadius: '10px',
                  fontSize: '10px', fontWeight: 600,
                  color: tokens.teal, background: hexToRgba(tokens.teal, 0.1),
                }}>
                  {ind}
                </span>
              ))}
              {agentResult.citedStrategy && (
                <span style={{
                  padding: '2px 8px', borderRadius: '10px',
                  fontSize: '10px', fontWeight: 600,
                  color: tokens.purple, background: hexToRgba(tokens.purple || '#8b5cf6', 0.1),
                }}>
                  {agentResult.citedStrategy}
                </span>
              )}
            </div>

            {/* Conviction bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', color: tokens.textMuted }}>Conviction:</span>
              <div style={{
                flex: 1, height: '6px', borderRadius: '3px',
                background: hexToRgba(tokens.teal, 0.15),
              }}>
                <div style={{
                  width: `${agentResult.conviction || 0}%`,
                  height: '100%', borderRadius: '3px',
                  background: tokens.teal,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: tokens.teal, fontFamily: 'monospace' }}>
                {agentResult.conviction || 0}
              </span>
            </div>

            {/* Outcome buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleOutcome('conceded')}
                style={{
                  flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                  background: hexToRgba(tokens.teal, 0.15), color: tokens.teal,
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                I'm Convinced
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleOutcome('convinced')}
                style={{
                  flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                  background: hexToRgba('#f59e0b', 0.15), color: '#f59e0b',
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                I Disagree
              </motion.button>
            </div>
          </>
        )}
      </div>
    </CenteredModal>
  );
};

export default DebateModal;
