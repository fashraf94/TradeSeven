// src/components/Dashboard/EquipSheet.jsx
//
// Generic bottom-sheet primitive for the Equip station's pickers (watchlist and
// rule bundles). Dumb/presentational: the caller supplies the rows and their
// onClick semantics, plus an optional footer (e.g. a "Build in Forge" CTA).
// Obsidian surface + agent-accent selection, matching the Command Dashboard.

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';

function hexToRgba(hex, a) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(94,234,212,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function EquipSheet({
  open, onClose, title, subtitle, loading, rows = [], emptyLabel, footer, accent, tokens,
}) {
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
            background: 'rgba(0,0,0,0.6)',
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
              background: tokens.bgCard,
              borderTopLeftRadius: 18, borderTopRightRadius: 18,
              borderTop: `1px solid ${tokens.borderDefault}`,
              maxHeight: '74vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* Grabber */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: tokens.borderInput }} />
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '12px 18px 8px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: tokens.textWhite }}>{title}</div>
                {subtitle && <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 3, lineHeight: 1.45 }}>{subtitle}</div>}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                style={{ background: 'transparent', border: 'none', color: tokens.textMuted, cursor: 'pointer', padding: 4, flexShrink: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', padding: '4px 12px 8px' }}>
              {loading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: tokens.textMuted, fontSize: 13 }}>Loading…</div>
              ) : rows.length === 0 ? (
                <div style={{ padding: '18px 10px', color: tokens.textMuted, fontSize: 13, lineHeight: 1.5 }}>
                  {emptyLabel || 'Nothing here yet.'}
                </div>
              ) : (
                rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={row.onClick}
                    disabled={row.disabled}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px', marginBottom: 6, borderRadius: 12, textAlign: 'left',
                      cursor: row.disabled ? 'default' : 'pointer', fontFamily: 'inherit',
                      background: row.selected ? hexToRgba(accent, 0.12) : tokens.bgElevated,
                      border: `1px solid ${row.selected ? hexToRgba(accent, 0.4) : tokens.borderDefault}`,
                      opacity: row.disabled ? 0.6 : 1,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: tokens.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.title}
                      </div>
                      {row.subtitle && <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>{row.subtitle}</div>}
                    </div>
                    {row.badge && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                        color: accent, background: hexToRgba(accent, 0.12), border: `1px solid ${hexToRgba(accent, 0.3)}`,
                        padding: '3px 8px', borderRadius: 20, flexShrink: 0,
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
              <div style={{ padding: '8px 16px 16px', borderTop: `1px solid ${tokens.borderDefault}` }}>
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
