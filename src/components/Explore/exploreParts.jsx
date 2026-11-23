// src/components/Explore/exploreParts.jsx
//
// Explore Build 1 — small parts, in the Round 1 mockup's shapes (build prompt K-15). Every button is a real
// <button> at least 44 px tall; its label is an inner span (src/index.css forces 16 px on <button>). Tones are
// tokens (exploreStyle.js). No words here: callers pass them from exploreCopy.js.

import React, { forwardRef, useId, useState } from 'react';
import { S, T, btnStyle, linkStyle, wash } from './exploreStyle';
import { EXPLORE_COPY } from './exploreCopy';
import { BOOKMARKS_MAX } from './exploreView';

export function Eyebrow({ as = 'div', id, tone = null, style, children }) {
  return React.createElement(as, { id, style: { ...S.eyebrow, color: tone ? T[tone] : T.ink3, ...style } }, children);
}

export function Tag({ tone = 'ink2', dim = false, children }) {
  const triplet = tone === 'ink2' ? 'ink-2' : tone;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, lineHeight: 1.5,
      // purple text fails 4.5:1 on its own wash (review C-4): a purple tag says its words in ink
      color: tone === 'ink2' ? T.ink2 : tone === 'purple' ? T.ink : T[tone], background: dim ? 'transparent' : wash(triplet, 0.1), border: `1px solid ${dim ? T.hair : wash(triplet, 0.35)}`,
      whiteSpace: 'normal', overflowWrap: 'anywhere',
    }}
    >
      {children}
    </span>
  );
}

/** A line with a dot: role "alert" for failures, "status" for results (K-15). */
export function Notice({ tone = 'copper', role, children }) {
  const triplet = tone === 'ink2' ? 'ink-2' : tone;
  return (
    <div role={role} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: wash(triplet, 0.08), border: `1px solid ${wash(triplet, 0.35)}`, minWidth: 0 }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: tone === 'ink2' ? T.ink2 : T[tone], flexShrink: 0, marginTop: 7 }} />
      <div style={{ ...S.body, fontSize: 13.5, flex: 1 }}>{children}</div>
    </div>
  );
}

/** A loading line (role "status"). */
export function StatusLine({ children }) {
  return <p role="status" style={{ ...S.meta, fontSize: 14, padding: '6px 0' }}>{children}</p>;
}

const Label = ({ size = 15, children }) => <span style={{ fontSize: size, lineHeight: 1.3 }}>{children}</span>;

/**
 * A button. `ariaDisabled` keeps it focusable while it cannot act (a disabled button that holds focus loses it in
 * Chromium); `disabled` is for one that never held focus (an empty question).
 */
export const Btn = forwardRef(function Btn({ kind = 'secondary', full = false, disabled = false, ariaDisabled = false, onClick, size, style, children, ...rest }, ref) {
  const inert = disabled || ariaDisabled;
  return (
    <button
      ref={ref}
      type="button"
      className="ftx-btn"
      disabled={disabled}
      aria-disabled={ariaDisabled ? 'true' : undefined}
      onClick={inert ? undefined : onClick}
      style={{ ...btnStyle(kind, { full, disabled: inert }), ...style }}
      {...rest}
    >
      <Label size={size}>{children}</Label>
    </button>
  );
});

export const LinkBtn = forwardRef(function LinkBtn({ onClick, tone = null, style, children, ...rest }, ref) {
  return (
    <button ref={ref} type="button" className="ftx-btn" onClick={onClick} style={{ ...linkStyle, ...(tone ? { color: T[tone] } : {}), ...style }} {...rest}>
      <Label size={14.5}>{children}</Label>
    </button>
  );
});

export function Icon({ name, size = 16 }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const g = {
    search: <g {...p}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></g>,
    mark: <path {...p} d="M4 2.5h8v11L8 10.6 4 13.5z" />,
    markOn: <path d="M4 2.5h8v11L8 10.6 4 13.5z" fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
    x: <path {...p} d="M3.5 3.5l9 9M12.5 3.5l-9 9" />,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" style={{ flexShrink: 0, display: 'block' }}>{g[name]}</svg>;
}

/** Save for later: a toggle with aria-pressed (spec §3.8). Its label stays the same; the pressed state shows in the mark. */
export function SaveToggle({ pressed, busy = false, label, onToggle, kind = 'ghost' }) {
  return (
    <button
      type="button"
      className="ftx-btn"
      aria-pressed={pressed ? 'true' : 'false'}
      aria-disabled={busy ? 'true' : undefined}
      data-explore-save=""
      onClick={busy ? undefined : onToggle}
      style={{ ...btnStyle(kind), ...(pressed ? { color: T.teal } : {}) }}
    >
      <Icon name={pressed ? 'markOn' : 'mark'} />
      <Label size={14.5}>{label}</Label>
    </button>
  );
}

/**
 * A failed bookmark write for this story, in one line (spec §3.8): a save, a remove, or the client's cap — shown only
 * next to the control that was tapped (`origin`: a card, a saved row, the reader's byline, the panel), so a story on
 * two cards still says it once (review B-9).
 */
export function BookmarkError({ bookmarks, storyId, origin = null }) {
  const error = bookmarks.errors && Object.hasOwn(bookmarks.errors, storyId) ? bookmarks.errors[storyId] : null;
  if (!error || error.origin !== origin) return null;
  const COPY = EXPLORE_COPY.bookmark;
  const words = error.kind === 'cap' ? COPY.cap(BOOKMARKS_MAX) : error.kind === 'remove' ? COPY.failedRemove : COPY.failedSave;
  return <Notice role="alert" tone="copper"><span data-explore-bookmark-error={error.kind}>{words}</span></Notice>;
}

/** A collapsed section (spec §3.4 items 8 and 9). */
export function Disclosure({ label, count = null, children }) {
  const [open, setOpen] = useState(false);
  const id = `ftx-d${useId()}`;
  return (
    <section style={{ borderRadius: 14, border: `1px solid ${T.hair}`, background: T.surface, overflow: 'hidden' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        style={{ appearance: 'none', font: 'inherit', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 48, padding: '8px 14px', textAlign: 'left', color: T.ink }}
      >
        <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 15 }}>{label}</span>
        {count !== null && <span style={{ fontSize: 12, color: T.ink2 }}>{count}</span>}
        <span aria-hidden="true" style={{ color: T.ink2, fontSize: 14 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div id={id} style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>}
    </section>
  );
}
