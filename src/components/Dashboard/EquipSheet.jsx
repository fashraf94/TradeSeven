// src/components/Dashboard/EquipSheet.jsx
//
// Generic bottom-sheet primitive for the Equip station's pickers (watchlist and
// rule bundles). Dumb/presentational: the caller supplies rows + their onClick
// semantics (or arbitrary `children` for richer pickers like the archetype hero
// cards), plus an optional footer (a "Build/Create in Forge" CTA). Styled to
// the prototype's command-bridge sheet (obsidian raised surface, agent-accent
// selection).
//
// A dialog (Command Center S8 fix build, ruling R-S8F-6; spec V1.2 §10; the S8
// review's S8-8): role="dialog", aria-modal, labelled by its title; on open,
// focus moves to Close; Tab and Shift+Tab stay inside; Escape closes it; on
// close, focus goes back to what had it when the sheet opened — unless the host
// has already moved it out of the sheet (the Command Center hub's overlay stack
// returns focus to the opener itself), so there is exactly one restore. Every
// sheet built on this primitive gains the same semantics. useModalFocus is not
// reused: its restore is unconditional and it has no Escape.

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { CMD, alpha } from './commandUI';
import { cssVar } from '../../theme/cssTokens';

/**
 * A keyboard-only focus outline on the sheet's Close and row buttons (founder ruling Q-S8F-2): `:focus-visible`, so a
 * pointer or a touch shows none. The buttons' inline `all: 'unset'` takes their outline with it, so the rule is
 * `!important` to win over it. The hub's own focus colour (hub/hubStyle.js HUB_FOCUS_CSS), as a token.
 */
const CONTROL_FOCUS_CSS = `[data-equip-sheet-control]:focus-visible { outline: 2px solid ${cssVar('teal')} !important; outline-offset: 2px !important; }`;

const FOCUSABLE ='button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function EquipSheet({ open, onClose, title, subtitle, loading, rows = [], emptyLabel, footer, accent, dock = 'bottom', children }) {
  // 'bottom' = mobile bottom sheet (default, unchanged); 'center' = desktop modal.
  const center = dock === 'center';
  const titleId = `equip-sheet-title${useId()}`;
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  // The latest onClose, for the document listener below (registered once per open).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    closeRef.current?.focus();
    return () => {
      // Exactly one restore: a host that already took focus out of the sheet keeps it where it put it.
      const active = document.activeElement;
      const stillHere = !active || active === document.body || Boolean(dialogRef.current?.contains(active));
      if (!stillHere || !opener || opener === document.body || !opener.isConnected || typeof opener.focus !== 'function') return;
      opener.focus();
    };
  }, [open]);

  /** Escape closes; Tab and Shift+Tab cycle inside. Focus outside the cycle (on the dialog, or nowhere) re-enters it. */
  const handleKey = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCloseRef.current?.();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const nodes = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!nodes.includes(document.activeElement)) {
      // Focus on the dialog itself (after a click on its content) or astray: back into the cycle.
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onKeyDown = (event) => {
    // A keydown from an overlay rendered among this sheet's children (a portal elsewhere in the DOM) is that overlay's.
    if (!dialogRef.current?.contains(event.target)) return;
    handleKey(event);
  };

  // Focus can fall out of an open sheet without leaving it: the control that had it unmounts (the archetype picker swaps
  // its cards for the confirm step) and focus drops to <body>, where no key reaches the dialog's own handler. Those keys
  // are still the sheet's (the build's review, L1-1) — unless the sheet sits under an overlay that made it inert.
  useEffect(() => {
    if (!open) return undefined;
    const onStrayKey = (event) => {
      if (event.target !== document.body) return;
      const dialog = dialogRef.current;
      if (!dialog || !dialog.isConnected || dialog.closest('[inert]')) return;
      handleKey(event);
    };
    document.addEventListener('keydown', onStrayKey);
    return () => document.removeEventListener('keydown', onStrayKey);
    // handleKey reads only refs and the DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Portaled to <body>: the Command Dashboard shells' roots are stacking
  // contexts (position relative + zIndex 1), which would cap this overlay's
  // zIndex 1000 at level 1 — below the App-level BottomNav (50) and desktop
  // sidebar (40). Rendered inline, the nav paints over the sheet's bottom rows.
  return createPortal(
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
            display: 'flex', flexDirection: 'column',
            justifyContent: center ? 'center' : 'flex-end', alignItems: center ? 'center' : 'stretch',
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            initial={center ? { opacity: 0, scale: 0.96, y: 8 } : { y: '100%' }}
            animate={center ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={center ? { opacity: 0, scale: 0.96, y: 8 } : { y: '100%' }}
            transition={center ? { duration: 0.22, ease: [0.22, 1, 0.36, 1] } : { type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              outline: 'none',
              background: CMD.raised, borderTopLeftRadius: 26, borderTopRightRadius: 26,
              borderBottomLeftRadius: center ? 26 : 0, borderBottomRightRadius: center ? 26 : 0,
              border: center ? `1px solid ${CMD.hair2}` : undefined, borderTop: `1px solid ${CMD.hair2}`,
              width: center ? 460 : undefined, maxWidth: center ? '90%' : undefined,
              maxHeight: center ? '84%' : '82%', display: 'flex', flexDirection: 'column',
              boxShadow: center ? '0 30px 80px rgba(0,0,0,0.6)' : '0 -20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <style>{CONTROL_FOCUS_CSS}</style>
            {!center && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
                <div style={{ width: 38, height: 4.5, borderRadius: 99, background: CMD.hair2 }} />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '12px 20px 12px', borderBottom: `1px solid ${CMD.hair}` }}>
              <div style={{ minWidth: 0 }}>
                <div id={titleId} style={{ fontSize: 16, fontWeight: 700, color: CMD.ink }}>{title}</div>
                {subtitle && <div style={{ fontSize: 12, color: CMD.ink2, marginTop: 3, lineHeight: 1.45 }}>{subtitle}</div>}
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label="Close"
                data-equip-sheet-control=""
                style={{ all: 'unset', width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: CMD.surface, cursor: 'pointer' }}
              >
                <X size={16} color={CMD.ink2} />
              </button>
            </div>

            {/* Footerless bottom sheets scroll to the viewport edge — pad the
                last row clear of the iOS home-indicator inset. (With a footer,
                the footer carries the inset below the scroll area.) */}
            <div style={{ overflowY: 'auto', padding: '10px 14px', paddingBottom: !center && !footer ? 'calc(env(safe-area-inset-bottom, 0px) + 10px)' : 10 }}>
              {children != null ? children : loading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: CMD.ink2, fontSize: 13 }}>Loading…</div>
              ) : rows.length === 0 ? (
                <div style={{ padding: '18px 8px', color: CMD.ink2, fontSize: 13, lineHeight: 1.5 }}>{emptyLabel || 'Nothing here yet.'}</div>
              ) : (
                rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    data-equip-sheet-control=""
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
              <div style={{ padding: center ? '8px 18px 16px' : '8px 18px calc(env(safe-area-inset-bottom, 0px) + 16px)', borderTop: `1px solid ${CMD.hair}` }}>
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
