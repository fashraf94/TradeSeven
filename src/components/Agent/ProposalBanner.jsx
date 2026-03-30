// ProposalBanner - Floating bottom-anchored banner for Co-Pilot proposals
// Expanded: trade details, TTL bar, approve/veto buttons, cited Forge rules
// Minimized: floating timer pill, tap/swipe to re-expand

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { ArrowRightLeft, Check, X, Clock, ChevronDown } from 'lucide-react';
import { resolveProposal, appendBattleLedger } from '../../services/agentService';

// ─── Constants ────────────────────────────────────────────────────────────────

const VETO_REASONS = [
  'Disagree with thesis',
  'Bad timing',
  'Other',
];

const TTL_TOTAL_MS = 10 * 60 * 1000; // 10 minutes
const TTL_AMBER_MS = 3 * 60 * 1000;
const TTL_RED_MS = 1 * 60 * 1000;

const hexToRgba = (hex, alpha) => {
  if (!hex || hex.charAt(0) !== '#') return `rgba(150,150,150,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// ─── TTL Bar ──────────────────────────────────────────────────────────────────

function TtlBar({ msRemaining, tokens }) {
  const totalMs = TTL_TOTAL_MS;
  const fraction = Math.max(0, Math.min(1, msRemaining / totalMs));

  let barColor = tokens.teal || '#5eead4';
  if (msRemaining <= TTL_RED_MS) barColor = tokens.red || '#ef4444';
  else if (msRemaining <= TTL_AMBER_MS) barColor = tokens.amber || '#f59e0b';

  return (
    <div style={{
      width: '100%',
      height: 3,
      borderRadius: 1.5,
      background: 'rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <motion.div
        animate={{ width: `${fraction * 100}%` }}
        transition={{ duration: 1, ease: 'linear' }}
        style={{
          height: '100%',
          borderRadius: 1.5,
          background: barColor,
        }}
      />
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function ActionToast({ message, color, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      style={{
        position: 'fixed',
        bottom: 160,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1001,
        padding: '8px 20px',
        borderRadius: 20,
        background: 'rgba(13,14,18,0.95)',
        border: `1px solid ${hexToRgba(color, 0.4)}`,
        color,
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(12px)',
      }}
    >
      {message}
    </motion.div>
  );
}

// ─── Minimized Pill ───────────────────────────────────────────────────────────

function TimerPill({ msRemaining, tokens, onExpand }) {
  const minutes = Math.floor(msRemaining / 60000);
  const seconds = Math.floor((msRemaining % 60000) / 1000);
  const timerText = `${minutes}:${String(seconds).padStart(2, '0')}`;

  let dotColor = tokens.teal || '#5eead4';
  if (msRemaining <= TTL_RED_MS) dotColor = tokens.red || '#ef4444';
  else if (msRemaining <= TTL_AMBER_MS) dotColor = tokens.amber || '#f59e0b';

  const y = useMotionValue(0);

  const handleDragEnd = (_, info) => {
    if (info.offset.y < -30) onExpand();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      drag="y"
      dragConstraints={{ top: -60, bottom: 0 }}
      dragElastic={0.3}
      onDragEnd={handleDragEnd}
      style={{
        position: 'fixed',
        bottom: 84,
        right: 16,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 20,
        background: 'rgba(13,14,18,0.95)',
        border: `1px solid ${hexToRgba(dotColor, 0.3)}`,
        cursor: 'pointer',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        y,
      }}
      onClick={onExpand}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
        }}
      />
      <span style={{
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'monospace',
        color: tokens.textPrimary || '#e2e8f0',
      }}>
        {timerText} remaining
      </span>
    </motion.div>
  );
}

// ─── Main Banner ──────────────────────────────────────────────────────────────

export default function ProposalBanner({
  pendingProposal,
  executionMode,
  battleId,
  onCitationTap,
  tokens,
}) {
  const [minimized, setMinimized] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showVetoReasons, setShowVetoReasons] = useState(false);
  const [msRemaining, setMsRemaining] = useState(0);
  const [toast, setToast] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const proposalIdRef = useRef(null);

  const proposal = pendingProposal;

  // Reset state when a new proposal arrives
  useEffect(() => {
    if (proposal?.proposalId && proposal.proposalId !== proposalIdRef.current) {
      proposalIdRef.current = proposal.proposalId;
      setMinimized(false);
      setShowVetoReasons(false);
      setDismissed(false);
      setResolving(false);
    }
  }, [proposal?.proposalId]);

  // Countdown timer
  useEffect(() => {
    if (!proposal?.expiresAt) return;
    const update = () => {
      const remaining = Math.max(0, new Date(proposal.expiresAt).getTime() - Date.now());
      setMsRemaining(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [proposal?.expiresAt]);

  // Handle TTL expiry
  useEffect(() => {
    if (msRemaining === 0 && proposal && !proposal.resolvedAt && !dismissed) {
      setDismissed(true);
    }
  }, [msRemaining, proposal, dismissed]);

  // Visibility: show only in copilot/manual mode, with an unresolved proposal
  const isVisible = proposal
    && !proposal.resolvedAt
    && (executionMode === 'copilot' || executionMode === 'manual')
    && !dismissed;

  // Drag-to-minimize on expanded banner
  const y = useMotionValue(0);

  const handleDragEnd = useCallback((_, info) => {
    if (info.offset.y > 40) {
      setMinimized(true);
    }
  }, []);

  // Approve handler
  const handleApprove = useCallback(async () => {
    if (resolving || !battleId || !proposal) return;
    setResolving(true);
    try {
      await resolveProposal(battleId, proposal, 'approved');
      await appendBattleLedger(battleId, {
        type: 'approve',
        details: {
          proposalId: proposal.proposalId,
          symbolOut: proposal.symbolOut,
          symbolIn: proposal.symbolIn,
        },
      });
      setToast({ message: 'Trade approved', color: tokens.teal || '#5eead4' });
    } catch (err) {
      console.error('[ProposalBanner] Approve failed:', err.message);
    }
    setResolving(false);
  }, [resolving, battleId, proposal, tokens.teal]);

  // Veto handler
  const handleVeto = useCallback(async (reason) => {
    if (resolving || !battleId || !proposal) return;
    setResolving(true);
    try {
      await resolveProposal(battleId, proposal, 'vetoed', reason);
      await appendBattleLedger(battleId, {
        type: 'veto',
        details: {
          proposalId: proposal.proposalId,
          symbolOut: proposal.symbolOut,
          symbolIn: proposal.symbolIn,
          reason,
        },
      });
      setToast({ message: 'Trade vetoed', color: tokens.red || '#ef4444' });
    } catch (err) {
      console.error('[ProposalBanner] Veto failed:', err.message);
    }
    setResolving(false);
    setShowVetoReasons(false);
  }, [resolving, battleId, proposal, tokens.red]);

  const citedRules = proposal?.citedForgeRules || proposal?.citedRules || [];

  // Format timer text
  const minutes = Math.floor(msRemaining / 60000);
  const seconds = Math.floor((msRemaining % 60000) / 1000);
  const timerText = msRemaining <= 0 ? 'Expired' : `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <ActionToast
            message={toast.message}
            color={toast.color}
            onDone={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      {/* Minimized pill */}
      <AnimatePresence>
        {isVisible && minimized && (
          <TimerPill
            msRemaining={msRemaining}
            tokens={tokens}
            onExpand={() => setMinimized(false)}
          />
        )}
      </AnimatePresence>

      {/* Expanded banner */}
      <AnimatePresence>
        {isVisible && !minimized && (
          <motion.div
            key="proposal-banner"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 80 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            style={{
              position: 'fixed',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'calc(100% - 24px)',
              maxWidth: 576,
              zIndex: 999,
              borderRadius: 16,
              background: 'rgba(13,14,18,0.95)',
              border: `1px solid rgba(96,165,250,0.3)`,
              backdropFilter: 'blur(16px)',
              boxShadow: '0 -4px 30px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              y,
            }}
          >
            {/* Drag handle */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '6px 0 2px',
              cursor: 'grab',
            }}>
              <div style={{
                width: 32,
                height: 3,
                borderRadius: 1.5,
                background: 'rgba(255,255,255,0.15)',
              }} />
            </div>

            {/* TTL progress bar */}
            <div style={{ padding: '0 16px 8px' }}>
              <TtlBar msRemaining={msRemaining} tokens={tokens} />
            </div>

            {/* Content */}
            <div style={{ padding: '0 16px 12px' }}>
              {/* Trade + timer row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  color: tokens.textWhite || '#f8fafc',
                }}>
                  <span>Sell {proposal?.symbolOut}</span>
                  <ArrowRightLeft size={14} color={tokens.teal || '#5eead4'} />
                  <span>Buy {proposal?.symbolIn}</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  color: msRemaining <= TTL_RED_MS
                    ? (tokens.red || '#ef4444')
                    : msRemaining <= TTL_AMBER_MS
                      ? (tokens.amber || '#f59e0b')
                      : (tokens.textMuted || '#94a3b8'),
                }}>
                  <Clock size={11} />
                  {timerText}
                </div>
              </div>

              {/* Rationale (1-line truncated) */}
              {proposal?.rationale && (
                <p style={{
                  fontSize: 12,
                  color: tokens.textSecondary || '#cbd5e1',
                  lineHeight: 1.4,
                  margin: '0 0 8px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {proposal.rationale}
                </p>
              )}

              {/* Cited Forge rules */}
              {citedRules.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 4,
                  marginBottom: 10,
                }}>
                  {citedRules.map((ruleId) => (
                    <button
                      key={ruleId}
                      onClick={() => onCitationTap?.(ruleId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.3px',
                        color: tokens.amber || '#f59e0b',
                        background: hexToRgba(tokens.amber || '#f59e0b', 0.1),
                        border: `1px solid ${hexToRgba(tokens.amber || '#f59e0b', 0.2)}`,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {ruleId}
                    </button>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <AnimatePresence mode="wait">
                {showVetoReasons ? (
                  <motion.div
                    key="veto-reasons"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 5 }}
                  >
                    <span style={{
                      fontSize: 10,
                      color: tokens.textFaint || '#64748b',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Why veto?
                    </span>
                    {VETO_REASONS.map((reason) => (
                      <motion.button
                        key={reason}
                        onClick={() => handleVeto(reason)}
                        disabled={resolving}
                        whileTap={{ scale: 0.97 }}
                        style={{
                          background: hexToRgba(tokens.red || '#ef4444', 0.08),
                          border: `1px solid ${hexToRgba(tokens.red || '#ef4444', 0.15)}`,
                          borderRadius: 8,
                          padding: '7px 12px',
                          color: tokens.textSecondary || '#cbd5e1',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: resolving ? 'wait' : 'pointer',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                        }}
                      >
                        {reason}
                      </motion.button>
                    ))}
                    <motion.button
                      onClick={() => setShowVetoReasons(false)}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 4,
                        color: tokens.textFaint || '#64748b',
                        fontSize: 11,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
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
                    style={{ display: 'flex', gap: 8 }}
                  >
                    <motion.button
                      onClick={handleApprove}
                      disabled={resolving || msRemaining <= 0}
                      aria-label="Approve proposed trade"
                      whileTap={resolving ? {} : { scale: 0.97 }}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '12px 10px',
                        minHeight: 44,
                        borderRadius: 10,
                        border: 'none',
                        background: `linear-gradient(135deg, ${tokens.teal || '#5eead4'}, #0d9488)`,
                        color: '#0f172a',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: resolving || msRemaining <= 0 ? 'not-allowed' : 'pointer',
                        opacity: resolving || msRemaining <= 0 ? 0.5 : 1,
                        fontFamily: 'inherit',
                      }}
                    >
                      <Check size={14} />
                      Approve
                    </motion.button>

                    <motion.button
                      onClick={() => setShowVetoReasons(true)}
                      disabled={resolving || msRemaining <= 0}
                      aria-label="Veto proposed trade"
                      whileTap={resolving ? {} : { scale: 0.97 }}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '12px 10px',
                        minHeight: 44,
                        borderRadius: 10,
                        border: `1px solid ${hexToRgba(tokens.red || '#ef4444', 0.3)}`,
                        background: hexToRgba(tokens.red || '#ef4444', 0.06),
                        color: tokens.red || '#ef4444',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: resolving || msRemaining <= 0 ? 'not-allowed' : 'pointer',
                        opacity: resolving || msRemaining <= 0 ? 0.5 : 1,
                        fontFamily: 'inherit',
                      }}
                    >
                      <X size={14} />
                      Veto
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
