// src/screens/battleView/ChatSheet.jsx
//
// The mobile chat sheet (Phase A, A4): the existing AgentChat as a NON-MODAL
// sheet under the board, with three detents (useChatSheet.js). One AgentChat
// per layout — the screen mounts it here OR in the desktop column, never
// both (rulings §3.10), so `ensure-opener` fires once per mount as today.
//
// Semantics, because "non-modal" is not one (design brief §3):
//   - `role="region"` with an accessible name; `tabIndex=-1` so focus can be
//     moved INTO it on expand (the door's focus lands on the composer via the
//     chat's own prefill effect and is left alone).
//   - One keyboard-reachable control cycles peek → half → full → peek, named
//     for what the next activation does; a second control collapses an open
//     sheet straight to peek. A pull on the grabber raises or lowers one
//     detent (pointer only; the buttons are the keyboard path).
//   - On collapse, focus goes back to the invoking control (returnFocusRef,
//     captured by the caller in its handler) — or to the handle.
//   - At half / full the sheet owns the scroll: the chat's message list is
//     the scroll container (AgentChat's controller layout sets
//     overscroll-behavior: contain); the page behind stays interactive.
//   - Peek shows the turn line — the SAME text the header renders, one source
//     — and the unread dot, cleared by the screen's effect when the sheet is
//     at half / full (never during render).
//
// Motion: the height animates through the `smooth` token, reduced-motion
// aware; the grabber's pull uses the `gesture` token. Colours go through the
// token bridge. Every string comes from battleViewCopy.js.

import React, { useEffect, useId, useRef } from 'react';
import { motion } from 'framer-motion';
import { cssVar } from '../../theme/cssTokens';
import { motionToken } from '../../theme/motion';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import {
  SHEET_DETENT,
  SHEET_DRAG_PX,
  detentHeightPx,
  isSheetOpen,
  lowerDetent,
  nextDetent,
  raiseDetent,
} from './useChatSheet';

const DRAG_CONSTRAINTS = Object.freeze({ top: 0, bottom: 0 });

function cycleName(detent) {
  if (detent === SHEET_DETENT.PEEK) return COPY.sheetOpen;
  if (detent === SHEET_DETENT.HALF) return COPY.sheetGrow;
  return COPY.sheetCollapse;
}

export default function ChatSheet({
  detent = SHEET_DETENT.PEEK,
  onDetentChange,
  returnFocusRef = null,
  viewportHeight,
  turnText = null,
  unread = false,
  unreadColor = null,
  reducedMotion = false,
  hidden = false,
  children,
}) {
  const sectionRef = useRef(null);
  const handleRef = useRef(null);
  const contentId = useId();
  const open = isSheetOpen(detent);
  const wasOpenRef = useRef(open);
  // Peek sizes itself to its content — the handle row and the composer,
  // however tall the draft grows (the chat collapses its message list at
  // peek, so nothing else contributes); half and full are viewport shares.
  const height = open ? detentHeightPx(detent, viewportHeight) : 'auto';
  // The height TWEENS on a detent change only. A viewport change (a mobile
  // toolbar collapsing as the player scrolls) re-sizes the sheet instantly —
  // the sheet moves when the player moves it, never on its own (review L1-F9).
  const prevDetentRef = useRef(detent);
  const detentChanged = prevDetentRef.current !== detent;
  useEffect(() => { prevDetentRef.current = detent; }, [detent]);
  const transition = detentChanged
    ? motionToken('smooth', { reducedMotion: Boolean(reducedMotion) })
    : motionToken('instant');
  // The grabber's release physics. Framer reads `dragTransition` for a drag's
  // snap-back (never the element's `transition` — review L2-F7), so the
  // `gesture` token's spring is handed over in that shape; reduced motion
  // hands over nothing, which is framer's instant settle.
  const gesture = motionToken('gesture', { reducedMotion: Boolean(reducedMotion) });
  const dragTransition = gesture.type === 'spring'
    ? { bounceStiffness: gesture.stiffness, bounceDamping: gesture.damping }
    : undefined;

  // Focus moves on the peek ↔ open transition only — never on half ↔ full.
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (open === wasOpen || typeof document === 'undefined') return;
    const section = sectionRef.current;
    const handle = handleRef.current;
    if (open) {
      const active = document.activeElement;
      const insideContent = Boolean(section && active && section.contains(active)
        && active !== handle && !(handle && handle.contains(active)));
      // The door already focused the composer: leave it. Otherwise land on
      // the region itself, so the expanded sheet is what is announced.
      if (!insideContent && section && typeof section.focus === 'function') section.focus();
      return;
    }
    const back = returnFocusRef ? returnFocusRef.current : null;
    if (returnFocusRef) returnFocusRef.current = null;
    // document.body is what a pointer leaves focused on Safari / touch: not a
    // return target (review CR4) — the handle is.
    const backIsOutside = Boolean(back && back !== document.body && back.isConnected
      && typeof back.focus === 'function' && !(section && section.contains(back)));
    if (backIsOutside) back.focus();
    else if (handle && typeof handle.focus === 'function') handle.focus();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (next) => {
    if (typeof onDetentChange === 'function' && next !== detent) onDetentChange(next, handleRef.current);
  };
  const onDragEnd = (_event, info) => {
    const dy = info?.offset?.y ?? 0;
    if (dy <= -SHEET_DRAG_PX) change(raiseDetent(detent));
    else if (dy >= SHEET_DRAG_PX) change(lowerDetent(detent));
  };

  const handleName = COPY.sheetHandleName(cycleName(detent), unread);

  return (
    <motion.section
      ref={sectionRef}
      role="region"
      aria-label={COPY.sheetName}
      tabIndex={-1}
      data-chat-sheet={detent}
      data-sheet-height={String(height)}
      initial={false}
      animate={{ height }}
      transition={transition}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        height,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: cssVar('bg-dashboard'),
        borderTop: `1px solid rgba(${cssVar('scrim-rgb')}, 0.12)`,
        borderRadius: '14px 14px 0 0',
        boxShadow: `0 -8px 24px rgba(${cssVar('shadow-rgb')}, 0.35)`,
        outline: 'none',
        overflow: 'hidden',
        ...(hidden ? { visibility: 'hidden' } : {}),
      }}
    >
      {/* The handle row: grabber (pointer), the cycle control (keyboard),
          the turn line, the unread dot, and — open — the collapse control. */}
      <div
        data-sheet-handle="1"
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px 6px 16px',
          minHeight: 36,
          boxSizing: 'border-box',
          background: cssVar('bg-agent'),
          borderBottom: `1px solid rgba(${cssVar('scrim-rgb')}, 0.07)`,
        }}
      >
        <motion.div
          aria-hidden="true"
          data-sheet-grabber="1"
          drag="y"
          dragConstraints={DRAG_CONSTRAINTS}
          dragElastic={0.12}
          dragMomentum={false}
          onDragEnd={onDragEnd}
          {...(dragTransition ? { dragTransition } : {})}
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: `rgba(${cssVar('scrim-rgb')}, 0.25)`,
            flexShrink: 0,
            cursor: 'grab',
            touchAction: 'none',
          }}
        />
        <button
          ref={handleRef}
          type="button"
          onClick={() => change(nextDetent(detent))}
          aria-expanded={open ? 'true' : 'false'}
          aria-controls={contentId}
          aria-label={handleName}
          data-sheet-cycle="1"
          data-unread={unread ? 'true' : 'false'}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            padding: '4px 0',
            cursor: 'pointer',
            color: cssVar('text-secondary'),
            fontSize: 11,
            letterSpacing: '0.02em',
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'left',
          }}
        >
          {unread && (
            <span
              aria-hidden="true"
              data-sheet-dot="1"
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                flexShrink: 0,
                background: unreadColor || cssVar('teal'),
              }}
            />
          )}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {turnText}
          </span>
        </button>
        {open && (
          <button
            type="button"
            onClick={() => change(SHEET_DETENT.PEEK)}
            aria-label={COPY.sheetCollapse}
            data-sheet-collapse="1"
            style={{
              flexShrink: 0,
              width: 32,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: `1px solid rgba(${cssVar('scrim-rgb')}, 0.12)`,
              borderRadius: 8,
              color: cssVar('text-secondary'),
              cursor: 'pointer',
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            <span aria-hidden="true">▾</span>
          </button>
        )}
      </div>

      {/* The chat — its own message list is the scroll container. */}
      <div
        id={contentId}
        data-sheet-content="1"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </motion.section>
  );
}
