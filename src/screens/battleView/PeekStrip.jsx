// src/screens/battleView/PeekStrip.jsx
//
// The peek strip (Phase A2, A2.4, D-74) — the chat folded to one line of what
// just happened, on both shells.
//
// Two pieces, because the two shells need different amounts of it:
//
//   PeekLine   the newest tape entry, clipped to one line. The MOBILE sheet
//              renders this under its handle row at peek — the handle already
//              carries the turn line and the unread dot.
//   PeekStrip  the DESKTOP collapsed shell: an expand control carrying the
//              turn line and the unread dot, then the same PeekLine, then the
//              chat with its message list collapsed (so what is left of it is
//              the composer). It sits at the bottom of the board column while
//              the board takes the full width.
//
// NO MOTION BETWEEN LINES (seed §A2.4). The line updates when the tape does
// and does nothing in between — the whole screen's rule (nothing moves unless
// the player moved it or a check landed), and a strip that animated on every
// price tick would be the busiest liar on the page.
//
// The unread dot lives on the strip while collapsed — the mobile rule (A4),
// applied to the desktop's own collapsed state.
//
// Colours through the token bridge; every string from battleViewCopy.js.

import React from 'react';
import { cssVar } from '../../theme/cssTokens';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

/**
 * The newest tape entry, on one line. Clipped by the browser at the width the
 * reader actually has — never cut to a character count in the string.
 */
export function PeekLine({ text }) {
  if (!text) return null;
  return (
    <div
      data-peek-line="1"
      style={{
        fontSize: 11,
        color: cssVar('text-muted'),
        letterSpacing: '0.02em',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        padding: '0 16px 6px',
      }}
    >
      {text}
    </div>
  );
}

/**
 * The desktop's collapsed chat: the turn line and the newest line above the
 * composer, at the bottom of the board column.
 *
 * The whole top row is the expand control, so the target is the strip rather
 * than a chevron — the same shape the mobile handle takes.
 */
export function PeekStrip({
  // A2.4 (review L2-F4): the control the screen hands focus BACK to. Collapsing
  // and expanding each destroy the control that was clicked, and without this
  // a keyboard user was dropped to `document.body` — the mobile sheet has had a
  // return-focus contract for this exact transition since A4 (review CR4).
  expandRef = null,
  // A2.4 (review RB-F11): the id of the region this control expands — the
  // desktop chat column, which contains both this strip and the collapsed
  // chat beneath it. Without it `aria-expanded="false"` names nothing.
  controlsId = null,
  turnText = null,
  line = null,
  unread = false,
  unreadColor = null,
  onExpand,
  reducedMotion = false,
  children,
}) {
  return (
    <div
      data-peek-strip="1"
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: cssVar('bg-agent'),
        borderTop: `1px solid rgba(${cssVar('scrim-rgb')}, 0.12)`,
      }}
    >
      <button
        ref={expandRef}
        type="button"
        onClick={onExpand}
        aria-expanded="false"
        aria-controls={controlsId || undefined}
        aria-label={COPY.sheetHandleName(COPY.sheetExpand, unread)}
        data-peek-expand="1"
        data-unread={unread ? 'true' : 'false'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          padding: '8px 16px 4px',
          cursor: 'pointer',
          color: cssVar('text-secondary'),
          textAlign: 'left',
          width: '100%',
          minWidth: 0,
        }}
      >
        {unread && (
          <span
            aria-hidden="true"
            data-peek-dot="1"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              flexShrink: 0,
              background: unreadColor || cssVar('teal'),
            }}
          />
        )}
        {/* The size sits on the SPAN: index.css forces every <button> to 16 px
            (!important), so the turn line matches the header's 11 px only from
            here (A4 review, refuter A — the same reason the sheet's handle
            carries its own span). */}
        <span style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.02em' }}>
          {turnText}
        </span>
        <span aria-hidden="true" style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 12, lineHeight: 1 }}>▴</span>
      </button>
      <PeekLine text={line} />
      {/* `children` is optional: on the desktop the chat is the strip's
          SIBLING, not its child, so that collapsing cannot remount it
          (review L2-F1). `reducedMotion` is accepted and deliberately
          unused — nothing here animates, and a strip that grew a transition
          later must take it from the vocabulary with this flag rather than
          invent one (BUILD_RULES §11). */}
      {children ? (
        <div
          data-peek-content="1"
          style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
          data-reduced-motion={reducedMotion ? 'true' : 'false'}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default PeekStrip;
