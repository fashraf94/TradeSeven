// src/components/Dashboard/EquipSheet.jsx
//
// Generic bottom-sheet primitive for the Equip station's pickers (watchlist and
// rule bundles). Dumb/presentational: the caller supplies rows + their onClick
// semantics, plus an optional footer (a "Build/Create in Forge" CTA). Styled to
// the prototype's command-bridge sheet (obsidian raised surface, agent-accent
// selection).

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { CMD, alpha } from './commandUI';

export default function EquipSheet({ open, onClose, title, subtitle, loading, rows = [], emptyLabel, footer, accent }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(5,6,9,0.66)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: CMD.raised, borderTopLeftRadius: 26, borderTopRightRadius: 26,
              borderTop: `1px solid ${CMD.hair2}`, maxHeight: '82%', display: 'flex', flexDirection: 'column',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
              <div style={{ width: 38, height: 4.5, borderRadius: 99, background: CMD.hair2 }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '12px 20px 12px', borderBottom: `1px solid ${CMD.hair}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: CMD.ink }}>{title}</div>
                {subtitle && <div style={{ fontSize: 12, color: CMD.ink2, marginTop: 3, lineHeight: 1.45 }}>{subtitle}</div>}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                style={{ all: 'unset', width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: CMD.surface, cursor: 'pointer' }}
              >
                <X size={16} color={CMD.ink2} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '10px 14px' }}>
              {loading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: CMD.ink2, fontSize: 13 }}>Loading…</div>
              ) : rows.length === 0 ? (
                <div style={{ padding: '18px 8px', color: CMD.ink2, fontSize: 13, lineHeight: 1.5 }}>{emptyLabel || 'Nothing here yet.'}</div>
              ) : (
                rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={row.onClick}
                    disabled={row.disabled}
                    style={{
                      all: 'unset', boxSizing: 'border-box', width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px', marginBottom: 7, borderRadius: 13, cursor: row.disabled ? 'default' : 'pointer',
                      background: row.selected ? alpha(accent, 0.12) : CMD.surface,
                      border: `1px solid ${row.selected ? alpha(accent, 0.4) : CMD.hair}`, opacity: row.disabled ? 0.6 : 1,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: CMD.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.title}</div>
                      {row.subtitle && <div style={{ fontSize: 12, color: CMD.ink2, marginTop: 2 }}>{row.subtitle}</div>}
                    </div>
                    {row.badge && (
                      <span style={{
                        fontFamily: 'inherit', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: accent, background: alpha(accent, 0.12), border: `1px solid ${alpha(accent, 0.3)}`, padding: '3px 8px', borderRadius: 20, flexShrink: 0,
                      }}>
                        {row.badge}
                      </span>
                    )}
                    {row.selected && <Check size={18} color={accent} style={{ flexShrink: 0 }} />}
                  </button>
                ))
              )}
            </div>

            {footer && (
              <div style={{ padding: '8px 18px calc(env(safe-area-inset-bottom, 0px) + 16px)', borderTop: `1px solid ${CMD.hair}` }}>
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
