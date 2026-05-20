/**
 * PRESERVED FOR POST-LAUNCH REVISIT (2026-05-19)
 *
 * This component is part of the authority mode UX (auto-pilot / co-pilot / manual)
 * that was built but archived for launch. The product decision is auto-pilot only
 * for launch — see AUTHORITY_MODE_POST_LAUNCH_BACKLOG.md.
 *
 * This component is production-quality and ready to be remounted when co-pilot
 * and manual modes are revived. Do NOT delete it during cleanup passes.
 *
 * If you are reading this and considering deleting: read the backlog doc first.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRightLeft, Check, X, Pencil, Clock } from 'lucide-react';
import { resolveProposal, appendBattleLedger } from '../../services/agentService';

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const STRATEGY_LABELS = {
  volatility_squeeze: 'Squeeze', '52w_high_breakout': '52W High',
  rs_momentum: 'RS Mom', vwap_mean_reversion: 'VWAP MR',
  news_catalyst: 'News', bust_avoidance: 'Bust Guard',
  vwap_failure: 'VWAP Fail', threshold_lock: 'Locked',
};

const VETO_REASONS = [
  'Stock is overvalued',
  'Bad timing',
  'Wrong sector',
  'I have a hunch',
];

const Pill = ({ label, color }) => (
  <span style={{
    display: 'inline-flex', padding: '2px 8px', borderRadius: '10px',
    fontSize: '10px', fontWeight: '600', letterSpacing: '0.3px',
    color, background: hexToRgba(color, 0.12), border: `1px solid ${hexToRgba(color, 0.2)}`,
  }}>
    {label}
  </span>
);

const ProposalCard = ({ battleId, proposal, tokens }) => {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [showVetoReasons, setShowVetoReasons] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (!proposal?.expiresAt) return;
    const update = () => {
      const remaining = Math.max(0, Math.floor((new Date(proposal.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [proposal?.expiresAt]);

  if (!proposal || proposal.resolvedAt) return null;

  const isExpired = secondsLeft <= 0;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerText = isExpired
    ? (proposal.mode === 'copilot' ? 'Executing...' : 'Lapsing...')
    : `${minutes}:${String(seconds).padStart(2, '0')}`;

  const handleApprove = async () => {
    if (resolving || !battleId) return;
    setResolving(true);
    try {
      await resolveProposal(battleId, proposal, 'approved');
      await appendBattleLedger(battleId, {
        type: 'approve',
        details: { proposalId: proposal.proposalId, symbolOut: proposal.symbolOut, symbolIn: proposal.symbolIn },
      });
    } catch (err) {
      console.error('[Proposal] Approve failed:', err.message);
    }
    setResolving(false);
  };

  const handleVeto = async (reason) => {
    if (resolving || !battleId) return;
    setResolving(true);
    try {
      await resolveProposal(battleId, proposal, 'vetoed', reason);
      await appendBattleLedger(battleId, {
        type: 'veto',
        details: { proposalId: proposal.proposalId, symbolOut: proposal.symbolOut, symbolIn: proposal.symbolIn, reason },
      });
    } catch (err) {
      console.error('[Proposal] Veto failed:', err.message);
    }
    setResolving(false);
    setShowVetoReasons(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      style={{
        background: tokens.bgCard,
        borderRadius: '16px',
        border: `1px solid ${hexToRgba(tokens.amber, 0.25)}`,
        borderLeft: `3px solid ${tokens.amber}`,
        padding: '16px 20px',
        boxShadow: `${tokens.obsidianShadow}, 0 4px 16px rgba(0,0,0,0.3)`,
        backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
      }}
    >
      {/* Header: title + timer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowRightLeft size={14} color={tokens.amber} />
          <span style={{ fontSize: '12px', fontWeight: '700', color: tokens.amber, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Agent Proposal
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '12px', fontWeight: '600', fontFamily: 'monospace',
          color: isExpired ? tokens.red : tokens.textMuted,
        }}>
          <Clock size={12} />
          {timerText}
        </div>
      </div>

      {/* Swap details */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '15px', fontWeight: '700', color: tokens.textWhite, marginBottom: '8px',
      }}>
        <span>{proposal.symbolOut}</span>
        <span style={{ fontSize: '11px', color: tokens.textFaint }}>({proposal.tier})</span>
        <ArrowRightLeft size={14} color={tokens.textMuted} />
        <span>{proposal.symbolIn}</span>
      </div>

      {/* Rationale */}
      {proposal.rationale && (
        <p style={{ fontSize: '13px', color: tokens.textSecondary, lineHeight: '1.5', margin: '0 0 10px 0' }}>
          {proposal.rationale}
        </p>
      )}

      {/* Pills: strategy + conviction */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {(proposal.triggers || []).map((t, i) => (
          <Pill key={i} label={STRATEGY_LABELS[t] || t} color={tokens.teal} />
        ))}
        {proposal.regime && (
          <Pill label={proposal.regime.replace('directional_', '').replace('_', ' ')} color={tokens.textMuted} />
        )}
        <span style={{
          marginLeft: 'auto', fontSize: '12px', fontWeight: '600',
          color: proposal.conviction >= 80 ? tokens.emerald : tokens.amber,
        }}>
          {proposal.conviction}% conviction
        </span>
      </div>

      {/* Action buttons */}
      <AnimatePresence mode="wait">
        {showVetoReasons ? (
          <motion.div
            key="veto-reasons"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
          >
            <span style={{ fontSize: '11px', color: tokens.textFaint, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Why veto?
            </span>
            {VETO_REASONS.map((reason) => (
              <motion.button
                key={reason}
                onClick={() => handleVeto(reason)}
                disabled={resolving}
                whileTap={{ scale: 0.97 }}
                style={{
                  background: hexToRgba(tokens.red, 0.08),
                  border: `1px solid ${hexToRgba(tokens.red, 0.15)}`,
                  borderRadius: '8px', padding: '8px 12px',
                  color: tokens.textSecondary, fontSize: '12px', fontWeight: '500',
                  cursor: resolving ? 'wait' : 'pointer', textAlign: 'left',
                }}
              >
                {reason}
              </motion.button>
            ))}
            <motion.button
              onClick={() => setShowVetoReasons(false)}
              whileTap={{ scale: 0.97 }}
              style={{
                background: 'none', border: 'none', padding: '6px',
                color: tokens.textFaint, fontSize: '11px', cursor: 'pointer',
              }}
            >
              Cancel
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="action-buttons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', gap: '8px' }}
          >
            <motion.button
              onClick={handleApprove}
              disabled={resolving || isExpired}
              whileTap={resolving ? {} : { scale: 0.97 }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '10px', borderRadius: '10px', border: 'none',
                background: `linear-gradient(135deg, ${tokens.teal}, #0d9488)`,
                color: '#0f172a', fontSize: '13px', fontWeight: '700',
                cursor: resolving || isExpired ? 'not-allowed' : 'pointer',
                opacity: resolving || isExpired ? 0.5 : 1,
              }}
            >
              <Check size={14} />
              Approve
            </motion.button>

            <motion.button
              onClick={() => setShowVetoReasons(true)}
              disabled={resolving || isExpired}
              whileTap={resolving ? {} : { scale: 0.97 }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '10px', borderRadius: '10px',
                border: `1px solid ${hexToRgba(tokens.red, 0.3)}`,
                background: hexToRgba(tokens.red, 0.06),
                color: tokens.red, fontSize: '13px', fontWeight: '600',
                cursor: resolving || isExpired ? 'not-allowed' : 'pointer',
                opacity: resolving || isExpired ? 0.5 : 1,
              }}
            >
              <X size={14} />
              Veto
            </motion.button>

            <motion.button
              disabled
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '10px', borderRadius: '10px',
                border: `1px solid ${tokens.borderDefault}`,
                background: 'transparent',
                color: tokens.textFaint, fontSize: '13px', fontWeight: '500',
                cursor: 'not-allowed', opacity: 0.4,
              }}
              title="Coming soon — approve or veto for now"
            >
              <Pencil size={14} />
              Modify
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ProposalCard;
