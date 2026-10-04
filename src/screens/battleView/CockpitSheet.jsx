// src/screens/battleView/CockpitSheet.jsx
//
// THE COCKPIT SHEET — Cockpit Build 2a (spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md
// §7.5). One minimal modal for a tile's depth, built for the cockpit and NOT
// on ChatSheet (discovery D-A11: the only sheet here is the chat-bound,
// non-modal, three-detent one). A modal BOTTOM SHEET on the phone; a modal
// PANEL inside the pane on desktop.
//
//   MODAL      role="dialog" + aria-modal, labelled by its title; focus moves
//              in on open; Tab cycles inside (trapped — also from the panel
//              itself); Escape closes, from inside the sheet or from a focus
//              the page lost; a focus that fell to <body> (an answered tile's
//              buttons disappearing) comes back into the sheet (review L5-5).
//   FOCUS BACK on close to the control that opened it when it can still take
//              focus (connected, not inside a hidden or inert subtree), else
//              to the screen's own fallback (`restoreFocus`) — the tile that
//              now shows the call, never <body> (review L4-3, L5-5).
//   SCROLL     the sheet locks nothing itself: the screen renders the
//              scroller beneath with `overflowY: 'hidden'` while the sheet is
//              open, declaratively — a style mutation here wiped the
//              scroller's own `overflow-y` in a real browser and froze the
//              feed after the first close (review L4-1), and a body lock
//              interleaved with the pane's own (review L5-1).
//   CONTENT    from cockpitModel.sheetOf — the plain line, the agent's own
//              words ONLY when the record's saidOk is true (under the
//              unverified label), the facts, the default as an intent, the
//              receipts, the restatements, the check-card link, the buttons,
//              and the refusal line the model chose.
//   MOTION     the existing `smooth` token; `instant` under reduced motion.
//
// HAZARD 48: every label sizes an inner <span>.

import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cssVar } from '../../theme/cssTokens';
import { motionToken } from '../../theme/motion';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { AnswerButtons, StateTag, plainButton } from './CockpitFeed';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Can this element still take focus where the player would see it? */
function canTakeFocus(el) {
  return Boolean(el && typeof el.focus === 'function' && el.isConnected && !el.closest('[hidden], [inert]'));
}

/**
 * @param {object} props
 * @param {object|null} props.sheet   cockpitModel.sheetOf(...) — null renders nothing
 * @param {boolean} props.isDesktop
 * @param {boolean} props.reducedMotion
 * @param {string|null} props.checkGoneLine  shown after a tap on the check link found no card
 * @param {number} [props.bottomInset]  the phone's browser-chrome inset (the mark's F3 value)
 * @param {() => (HTMLElement|null)} [props.restoreFocus]  where focus goes when the opener cannot take it
 */
export default function CockpitSheet({
  sheet,
  isDesktop = false,
  reducedMotion = false,
  checkGoneLine = null,
  bottomInset = 0,
  restoreFocus = null,
  onClose,
  onAnswer,
  onOpenCheck,
}) {
  const panelRef = React.useRef(null);
  const returnRef = React.useRef(null);
  const restoreRef = React.useRef(restoreFocus);
  restoreRef.current = restoreFocus;
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  const open = Boolean(sheet);
  const titleId = 'cockpit-sheet-title';

  // FOCUS IN on open, BACK on close.
  React.useEffect(() => {
    if (!open) return undefined;
    returnRef.current = typeof document !== 'undefined' ? document.activeElement : null;
    const first = panelRef.current?.querySelector(FOCUSABLE);
    (first || panelRef.current)?.focus?.();
    return () => {
      const back = returnRef.current;
      returnRef.current = null;
      // Focus something else already placed (the chat's check-card landing
      // focuses its card in the same commit) is left where it is.
      const active = typeof document !== 'undefined' ? document.activeElement : null;
      if (active && active !== document.body && active.isConnected) return;
      if (canTakeFocus(back)) { back.focus(); return; }
      const fallback = typeof restoreRef.current === 'function' ? restoreRef.current() : null;
      if (canTakeFocus(fallback)) fallback.focus();
    };
  }, [open]);

  // A focus the page LOST (to <body>) while the sheet is open comes back in.
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const active = document.activeElement;
    if ((!active || active === document.body) && panelRef.current) panelRef.current.focus();
  });

  // Escape and Tab from a lost focus — the panel's own handler covers focus inside.
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const onDocKey = (e) => {
      const active = document.activeElement;
      const lost = !active || active === document.body;
      if (!lost) return;
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current?.(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        const nodes = [...(panelRef.current?.querySelectorAll(FOCUSABLE) ?? [])];
        (nodes[0] || panelRef.current)?.focus?.();
      }
    };
    document.addEventListener('keydown', onDocKey);
    return () => document.removeEventListener('keydown', onDocKey);
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose?.(); return; }
    if (e.key !== 'Tab') return;
    const nodes = [...(panelRef.current?.querySelectorAll(FOCUSABLE) ?? [])];
    if (nodes.length === 0) { e.preventDefault(); return; }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    // From the panel itself (focus came back to it), Tab and Shift+Tab stay inside too.
    if (active === panelRef.current) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };

  const refusal = sheet.refusalLine ?? null;

  return (
    <div
      data-cockpit-sheet-layer={isDesktop ? 'desktop' : 'mobile'}
      style={{
        position: isDesktop ? 'absolute' : 'fixed',
        inset: 0,
        zIndex: isDesktop ? 6 : 45,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: isDesktop ? 'center' : 'flex-end',
        alignItems: 'stretch',
      }}
    >
      <div
        aria-hidden="true"
        data-cockpit-sheet-backdrop="1"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: `rgba(var(--ft-shadow-rgb), 0.6)` }}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-cockpit-sheet="1"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        initial={reducedMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={motionToken('smooth', { reducedMotion })}
        style={{
          position: 'relative',
          margin: isDesktop ? '0 14px' : 0,
          maxHeight: isDesktop ? '86%' : '85vh',
          overflowY: 'auto',
          background: cssVar('bg-card-holo'),
          border: `1px solid rgba(var(--ft-scrim-rgb), 0.12)`,
          borderRadius: isDesktop ? 14 : '18px 18px 0 0',
          padding: isDesktop ? '14px 16px 18px' : `14px 16px ${18 + (Number.isFinite(bottomInset) && bottomInset > 0 ? bottomInset : 0)}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          color: cssVar('text-primary'),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: cssVar('teal') }}>
              {sheet.kindLabel}
              {sheet.eyebrow ? <span style={{ color: cssVar('text-secondary'), fontWeight: 500, textTransform: 'none', letterSpacing: '0.02em' }}>{' · '}{sheet.eyebrow}</span> : null}
            </span>
            <h2 id={titleId} style={{ margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.3 }}>{sheet.title}</h2>
            <StateTag tag={sheet.tag} />
          </div>
          <button
            type="button"
            data-cockpit-sheet-close="1"
            aria-label={COPY.cockpitSheetClose}
            onClick={onClose}
            style={{ minWidth: 36, minHeight: 36, border: 'none', background: 'transparent', color: cssVar('text-muted'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {sheet.restatedLine ? <span style={{ fontFamily: MONO, fontSize: 10.5, color: cssVar('text-secondary') }}>{sheet.restatedLine}</span> : null}
        {sheet.answerLine ? <span style={{ fontSize: 12, color: cssVar('call-yours') }}>{sheet.answerLine}</span> : null}

        {sheet.said ? (
          <figure data-cockpit-said="1" style={{ margin: 0, padding: '8px 10px', borderLeft: `2px solid ${cssVar('call-yours')}`, background: `rgba(var(--ft-teal-rgb), 0.05)` }}>
            <blockquote style={{ margin: 0, fontSize: 13, lineHeight: 1.5, fontStyle: 'italic', color: cssVar('text-secondary') }}>{sheet.said.text}</blockquote>
            <figcaption style={{ marginTop: 4, fontFamily: MONO, fontSize: 9.5, color: cssVar('text-secondary') }}>{sheet.said.label}</figcaption>
          </figure>
        ) : null}

        {sheet.facts.length > 0 ? (
          <dl data-cockpit-facts="1" style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {sheet.facts.map((f) => (
              <div key={f.key} data-cockpit-fact={f.key}>
                <dt style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: cssVar('text-secondary') }}>{f.label}</dt>
                <dd style={{ margin: '3px 0 0', fontFamily: MONO, fontSize: 12.5 }}>{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {sheet.defaultLine ? <span data-cockpit-default="1" style={{ fontSize: 12.5, color: cssVar('text-secondary') }}>{sheet.defaultLine}</span> : null}

        {sheet.receipts.length > 0 ? (
          <div data-cockpit-receipts="1" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: cssVar('text-secondary') }}>{COPY.cockpitSheetReceipts}</span>
            <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {sheet.receipts.map((r) => <li key={r.key} data-cockpit-receipt="1" style={{ fontFamily: MONO, fontSize: 11.5, color: cssVar('text-secondary') }}>{r.text}</li>)}
            </ol>
          </div>
        ) : null}

        {sheet.restated.length > 0 ? (
          <div data-cockpit-restatements="1" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sheet.restated.map((r) => (
              <div key={r.key} data-cockpit-restatement="1" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: cssVar('text-secondary') }}>{r.check}</span>
                <span style={{ fontSize: 12.5, color: cssVar('text-secondary') }}>{r.line}</span>
              </div>
            ))}
          </div>
        ) : null}

        {sheet.checkLink?.label ? (
          <button
            type="button"
            data-cockpit-check-link={sheet.checkLink.evalId}
            onClick={() => onOpenCheck?.(sheet.checkLink.evalId)}
            style={{ ...plainButton, alignSelf: 'flex-start', minHeight: 36, display: 'flex', alignItems: 'center' }}
          >
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, lineHeight: 1.2, color: cssVar('teal') }}>{sheet.checkLink.label}</span>
          </button>
        ) : null}
        {checkGoneLine ? <span role="status" data-cockpit-check-gone="1" style={{ fontSize: 11.5, color: cssVar('text-secondary') }}>{checkGoneLine}</span> : null}

        <AnswerButtons buttons={sheet.buttons} onAnswer={onAnswer} />
        {sheet.blockedLine ? <span style={{ fontSize: 11.5, color: cssVar('text-secondary') }}>{sheet.blockedLine}</span> : null}
        <div role="status" aria-live="polite" data-cockpit-sheet-refusal={refusal ? '1' : '0'} style={{ fontSize: 11.5, color: cssVar('call-dropped') }}>{refusal}</div>
      </motion.div>
    </div>
  );
}
