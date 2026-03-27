import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, ArrowRight, Check, X, Pencil } from 'lucide-react';
import { resolveGameplanMeeting, appendBattleLedger } from '../../services/agentService';

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const GameplanMeetingCard = ({ battleId, meeting, tokens }) => {
  const [resolving, setResolving] = useState(false);

  if (!meeting || meeting.status !== 'pending') return null;

  const handleResolve = async (resolution) => {
    if (resolving || !battleId) return;
    setResolving(true);
    try {
      await resolveGameplanMeeting(battleId, resolution);
      await appendBattleLedger(battleId, {
        type: 'gameplan_resolved',
        details: { meetingId: meeting.id, resolution },
      });
    } catch (err) {
      console.error('[GameplanCard] Failed to resolve:', err.message);
    } finally {
      setResolving(false);
    }
  };

  const accentColor = '#f59e0b'; // Amber/orange

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{
        borderRadius: '14px',
        background: tokens.bgCard,
        border: `1px solid ${hexToRgba(accentColor, 0.3)}`,
        borderLeft: `3px solid ${accentColor}`,
        padding: '14px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle gradient */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
        backgroundImage: `linear-gradient(180deg, ${hexToRgba(accentColor, 0.04)} 0%, transparent 100%)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ClipboardList size={14} color={accentColor} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Gameplan Meeting
          </span>
        </div>
        <span style={{ fontSize: '10px', color: tokens.textFaint }}>
          Expires EOD
        </span>
      </div>

      {/* Diagnosis */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '3px' }}>
          Diagnosis
        </div>
        <div style={{ fontSize: '12px', color: tokens.textPrimary, lineHeight: '1.4' }}>
          {meeting.diagnosis}
        </div>
      </div>

      {/* Proposed Swaps */}
      {meeting.suggestedSwaps?.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' }}>
            Proposed Rotation
          </div>
          {meeting.suggestedSwaps.map((swap, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 8px', marginBottom: '4px',
              borderRadius: '8px', background: hexToRgba(accentColor, 0.06),
            }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>{swap.symbolOut}</span>
              <ArrowRight size={12} color={tokens.textMuted} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>{swap.symbolIn}</span>
              <span style={{ fontSize: '10px', color: tokens.textFaint, marginLeft: '4px', flex: 1 }}>
                {swap.rationale}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Opportunity */}
      {meeting.opportunity && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '3px' }}>
            Opportunity
          </div>
          <div style={{ fontSize: '12px', color: tokens.textSecondary, lineHeight: '1.4' }}>
            {meeting.opportunity}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleResolve('approved')}
          disabled={resolving}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            padding: '8px 12px', borderRadius: '10px', border: 'none',
            background: hexToRgba('#10b981', 0.15), color: '#10b981',
            fontSize: '12px', fontWeight: 700, cursor: resolving ? 'not-allowed' : 'pointer',
            opacity: resolving ? 0.5 : 1, fontFamily: 'inherit',
          }}
        >
          <Check size={13} /> Approve
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleResolve('rejected')}
          disabled={resolving}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            padding: '8px 12px', borderRadius: '10px', border: 'none',
            background: hexToRgba('#ef4444', 0.15), color: '#ef4444',
            fontSize: '12px', fontWeight: 700, cursor: resolving ? 'not-allowed' : 'pointer',
            opacity: resolving ? 0.5 : 1, fontFamily: 'inherit',
          }}
        >
          <X size={13} /> Reject
        </motion.button>

        <motion.button
          disabled
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            padding: '8px 12px', borderRadius: '10px', border: 'none',
            background: hexToRgba(tokens.textFaint, 0.08), color: tokens.textFaint,
            fontSize: '12px', fontWeight: 700, cursor: 'not-allowed',
            opacity: 0.4, fontFamily: 'inherit',
          }}
          title="Coming Soon"
        >
          <Pencil size={13} /> Modify
        </motion.button>
      </div>
    </motion.div>
  );
};

export default GameplanMeetingCard;
