// src/components/Forge/Watchlist/ColumnHelpModal.jsx
//
// Column Help Modal — a small portal modal that explains one cohort-list column
// in plain language, with the manual "Sort by this column" action relocated here
// from the header tap (so the title-tap can open help without losing sort).
//
// UI-only. Mirrors the AssetResearchModal portal idiom (createPortal to
// document.body, fixed backdrop that closes on tap, inner stopPropagation) and
// the surface's inline-`tokens` styling — NOT the MarketClash HOLO components.
// Closes on backdrop tap / the X / Escape.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function ColumnHelpModal({ columnKey, entry, sortable = false, onSort, onClose, tokens }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!entry) return null;

  return createPortal(
    <div
      onClick={onClose}
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={entry.label}
        style={{
          width: 'min(420px, 92vw)',
          background: tokens.bgCard,
          border: `1px solid ${tokens.borderDefault}`,
          borderRadius: 14,
          padding: 16,
          boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
          zIndex: 1101,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: tokens.textPrimary, lineHeight: 1.3 }}>
            {entry.label}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: `1px solid ${tokens.borderDefault}`,
              background: 'transparent',
              color: tokens.textMuted,
              fontSize: 16,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55, color: tokens.textSecondary }}>
          {entry.description}
        </div>

        {sortable && (
          <button
            type="button"
            onClick={() => onSort?.(columnKey)}
            style={{
              marginTop: 16,
              width: '100%',
              padding: '9px 12px',
              borderRadius: 10,
              border: `1px solid ${tokens.teal}55`,
              background: `${tokens.teal}1a`,
              color: tokens.teal,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Sort by this column
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
