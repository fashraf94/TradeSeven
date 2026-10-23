// src/components/CommandCenter/HubSheet.jsx
//
// Command Center hub, slice S1 — the sheet primitive (the design's FfSheet,
// ff-ui.jsx; spec V1.2 §10): a dialog on the desktop, tablet and stacked
// compositions, a bottom sheet on the phone.
//
//   - role="dialog", aria-modal, labelled by its title;
//   - on open, focus moves to Close; Tab and Shift+Tab cycle inside;
//   - Escape and the backdrop close it; on close, focus returns to the
//     control that opened it (`opener`, captured by the caller at the click —
//     Safari does not focus a clicked button), or, if that control is gone or
//     disabled by then, to `fallbackFocus` (S1 review L3-3);
//   - the dialog itself takes focus (tabIndex -1), so a click on its plain
//     content keeps the keys inside it, and the trap pulls stray focus back
//     (S1 review L3-2);
//   - while open, the background is inert: the sheet renders in a portal on
//     document.body and marks every other child of body `inert` (App's root
//     with it, so the strip and BottomNav too), restoring exactly what it
//     marked when it closes.
//
// Keys are handled on the dialog element itself (React's onKeyDown), so the
// sheet adds no document listener. Its only effect is its registration with the
// hub's overlay stack (hub/overlayStack.js), which owns the inert marks and the
// focus return (S5 ruling R-S5-6: one stack for every overlay the hub opens,
// so sheets closing out of order keep the background inert until the last one
// closes). Layer: above the strip (40) and BottomNav (50), below the root
// deploy ceremony (1010) — hub/hubStyle.js HUB_LAYERS.
//
// S1 opens one sheet, History, and only from the layout fixtures; production
// S1 has no completed games to open it from.

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { motionToken } from '../../theme/motion';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { useHubOverlays } from './hub/HubOverlays';
import { inertSiblings } from './hub/overlayStack';
import { C, HAIR, HAIR_2, HUB_LAYERS, tint } from './hub/hubStyle';
import { Eyebrow, Icon } from './HubParts';

// S1's primitive, kept for its own rows: the stack is built on it.
export { inertSiblings };

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function HubSheet({ title, eyebrow = null, label, phone = false, width = 560, onClose, opener = null, fallbackFocus = null, reducedMotion = false, children }) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const stack = useHubOverlays();
  const sheetId = `sheet${useId()}`;

  useEffect(() => {
    const invoker = opener || document.activeElement;
    // The stack marks the background inert (never this sheet's own root) and, on close, hands focus back:
    // to the opener, else the fallback. A removed or disabled opener cannot take focus. If both are gone
    // because the whole hub was replaced, the hub's provider hands focus on (hub/HubOverlays.jsx).
    stack.open(sheetId, { opener: invoker, keep: overlayRef.current });
    closeRef.current?.focus();
    return () => { stack.close(sheetId, { fallback: fallbackFocus }); };
    // The opener and the fallback are read once, at open: the sheet returns focus to what opened it.
  }, []);

  const onKeyDown = (event) => {
    // React bubbles a keydown from an overlay rendered among this one's children (a portal elsewhere in the DOM) up
    // through here. It is that overlay's to trap, not this one's (review E3-4).
    if (!dialogRef.current?.contains(event.target)) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const nodes = dialogRef.current.querySelectorAll(FOCUSABLE);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const inside = [...nodes].includes(document.activeElement);
    if (!inside) {
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

  const transition = motionToken('smooth', { reducedMotion });
  return createPortal(
    <div
      ref={overlayRef}
      data-hub-sheet-overlay=""
      style={{ position: 'fixed', inset: 0, zIndex: HUB_LAYERS.sheet, display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : 24 }}
    >
      <motion.div
        aria-hidden="true"
        data-hub-sheet-backdrop=""
        onClick={onClose}
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={transition}
        style={{ position: 'absolute', inset: 0, background: tint('shadow', 0.72), backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      />
      <motion.div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label || title}
        data-hub-sheet={phone ? 'bottom' : 'dialog'}
        onKeyDown={onKeyDown}
        initial={reducedMotion ? false : phone ? { y: '100%' } : { opacity: 0, scale: 0.97 }}
        animate={phone ? { y: 0 } : { opacity: 1, scale: 1 }}
        transition={transition}
        style={{
          position: 'relative', width: '100%', maxWidth: phone ? 'none' : width, maxHeight: phone ? '92%' : '90%', overflowY: 'auto',
          background: C.bg, border: `1px solid ${HAIR_2}`, borderRadius: phone ? '22px 22px 0 0' : 20,
          padding: phone ? '12px 18px calc(28px + env(safe-area-inset-bottom, 0px))' : '20px 24px 24px',
          boxShadow: `0 -20px 60px ${tint('shadow', 0.5)}`,
        }}
      >
        {phone && <div aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 4, background: HAIR_2, margin: '0 auto 14px' }} />}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.015em', margin: '4px 0 0', color: C.ink, lineHeight: 1.3, textWrap: 'pretty' }}>{title}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={COPY.sheet.close}
            data-hub-sheet-close=""
            style={{ appearance: 'none', font: 'inherit', cursor: 'pointer', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink2, background: C.surface, border: `1px solid ${HAIR}`, flexShrink: 0 }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div style={{ marginTop: 16 }}>{children}</div>
      </motion.div>
    </div>,
    document.body,
  );
}
