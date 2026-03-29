import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Zap, Hash } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const hexToRgba = (hex, alpha) => {
  if (!hex || hex.charAt(0) !== '#') return `rgba(100,100,100,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function getCategoryInfo(ruleId) {
  if (!ruleId) return { label: 'Rule', icon: Zap, color: '#5eead4' };
  // Convention: C-prefix = Constraint, S-prefix = Strategy
  if (ruleId.startsWith('C') || ruleId.includes('constraint') || ruleId.includes('avoidance') || ruleId.includes('guard')) {
    return { label: 'Constraint', icon: Shield, color: '#f59e0b' };
  }
  return { label: 'Strategy', icon: Zap, color: '#5eead4' };
}

// ── Component ─────────────────────────────────────────────────────────────────

const ForgeCitationCard = ({ isOpen, onClose, ruleId, battleData, statusFeed = [], tokens }) => {
  // Find rule in activeRules from battle context
  const activeRules = battleData?.agentContext?.activeRules || [];
  const rule = useMemo(() =>
    activeRules.find(r => r.id === ruleId || r.ruleId === ruleId || r.key === ruleId),
    [activeRules, ruleId]
  );

  // Count citations across the feed
  const citationCount = useMemo(() => {
    if (!ruleId) return 0;
    return statusFeed.filter(entry => {
      const cited = entry.citedForgeRules || entry.citedRules || [];
      return cited.includes(ruleId);
    }).length;
  }, [statusFeed, ruleId]);

  const categoryInfo = getCategoryInfo(ruleId);
  const CategoryIcon = categoryInfo.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 999,
            }}
          />

          {/* Card */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: '50vh',
              zIndex: 1000,
              background: tokens.bgElevated || '#161b22',
              borderRadius: '20px 20px 0 0',
              border: `1px solid ${hexToRgba(categoryInfo.color, 0.2)}`,
              borderBottom: 'none',
              padding: '20px 20px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Handle + close */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.15)',
                margin: '0 auto',
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                top: 10,
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CategoryIcon size={16} color={categoryInfo.color} />
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: categoryInfo.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {categoryInfo.label}
                </span>
              </div>
              <button
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: tokens.textMuted || '#6e7681',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Rule text */}
            <div>
              <p style={{
                fontSize: 14,
                color: tokens.textPrimary || '#e6edf3',
                lineHeight: 1.6,
                margin: 0,
                fontWeight: 500,
              }}>
                {rule?.text || rule?.description || rule?.content || ruleId || 'Rule details unavailable'}
              </p>
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Bundle name */}
              {rule?.bundleName && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 10px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  color: tokens.textSecondary || '#8b949e',
                  background: hexToRgba(tokens.textMuted || '#6e7681', 0.1),
                  border: `1px solid ${hexToRgba(tokens.textMuted || '#6e7681', 0.15)}`,
                }}>
                  {rule.bundleName}
                </span>
              )}

              {/* Citation count */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: tokens.textMuted || '#6e7681',
              }}>
                <Hash size={11} />
                {citationCount} citation{citationCount !== 1 ? 's' : ''} this battle
              </span>
            </div>

            {/* View in Forge Stats link */}
            <button
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${hexToRgba(tokens.teal || '#5eead4', 0.2)}`,
                background: hexToRgba(tokens.teal || '#5eead4', 0.06),
                color: tokens.teal || '#5eead4',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              View in Forge Stats
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ForgeCitationCard;
