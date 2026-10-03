// src/screens/battleView/CockpitSheet.jsx
//
// THE COCKPIT SHEET — Cockpit Build 2a (spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md
// §7.5). One minimal modal for a tile's depth, built for the cockpit and NOT
// on ChatSheet (discovery D-A11: the only sheet here is the chat-bound,
// non-modal, three-detent one). A modal BOTTOM SHEET on the phone; a modal
// PANEL inside the pane on desktop.
//
//   MODAL      role="dialog" + aria-modal, labelled by its title; focus moves
//              in on open, Tab cycles inside (trapped), Escape closes, and focus
//              returns to the control that opened it; the scroller beneath is
//              locked while it is open (the phone: the body; the desktop: the
//              feed's own scroller, handed in by the screen).
//   CONTENT    from cockpitModel.sheetOf — the plain line, the agent's own
//              words ONLY when the record's saidOk is true (under the
//              unverified label), the facts, the default as an intent, the
//              receipts, the restatements, the check-card link, the buttons.
//   MOTION     the existing `smooth` token; `instant` under reduced motion.
//
// HAZARD 48: every label sizes an inner <span>.

import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cssVar } from '../../theme/cssTokens';
import { motionToken } from '../../theme/motion';
import { BATTLE_VIEW_COPY as COPY, cockpitRefusalLine } from './battleViewCopy';
import { AnswerButtons, StateTag } from './CockpitFeed';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * @param {object} props
 * @param {object|null} props.sheet   cockpitModel.sheetOf(...) — null renders nothing
 * @param {boolean} props.isDesktop
 * @param {boolean} props.reducedMotion
 * @param {object|null} props.outcome { status, body } — the last refusal for this call
 * @param {string|null} props.checkGoneLine  shown after a tap on the check link found no card
 * @param {{ current: HTMLElement|null }} [props.lockRef]  the desktop scroller to lock
 */
export default function CockpitSheet({
  sheet,
  isDesktop = false,
  reducedMotion = false,
  outcome = null,
  checkGoneLine = null,
  lockRef = null,
  onClose,
  onAnswer,
  onOpenCheck,
}) {
  const panelRef = React.useRef(null);
  const returnRef = React.useRef(null);
  const open = Boolean(sheet);
  const titleId = 'cockpit-sheet-title';

  // FOCUS IN on open, BACK on close — the element that held focus when the sheet opened.
  React.useEffect(() => {
    if (!open) return undefined;
    returnRef.current = typeof document !== 'undefined' ? document.activeElement : null;
    const first = panelRef.current?.querySelector(FOCUSABLE);
    (first || panelRef.current)?.focus?.();
    return () => {
      const back = returnRef.current;
      returnRef.current = null;
      if (back && typeof back.focus === 'function' && back.isConnected) back.focus();
    };
  }, [open]);

  // SCROLL LOCK — the previous value restored, never assumed '' (the pane's own rule).
  React.useEffect(() => {
    if (!open) return undefined;
    const target = isDesktop ? lockRef?.current : (typeof document !== 'undefined' ? document.body : null);
    if (!target) return undefined;
    const previous = target.style.overflow;
    target.style.overflow = 'hidden';
    return () => { target.style.overflow = previous; };
  }, [open, isDesktop, lockRef]);

  if (!open) return null;

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose?.(); return; }
    if (e.key !== 'Tab') return;
    const nodes = [...(panelRef.current?.querySelectorAll(FOCUSABLE) ?? [])];
    if (nodes.length === 0) { e.preventDefault(); return; }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const refusal = outcome ? cockpitRefusalLine(outcome.status, outcome.body, { pendingLine: sheet.pendingLine }) : null;

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
        aria-roledescription={COPY.cockpitSheetName}
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
          padding: '14px 16px 18px',
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
              {sheet.eyebrow ? <span style={{ color: cssVar('text-muted'), fontWeight: 500, textTransform: 'none', letterSpacing: '0.02em' }}>{' · '}{sheet.eyebrow}</span> : null}
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

        {sheet.restatedLine ? <span style={{ fontFamily: MONO, fontSize: 10.5, color: cssVar('text-muted') }}>{sheet.restatedLine}</span> : null}
        {sheet.answerLine ? <span style={{ fontSize: 12, color: cssVar('call-yours') }}>{sheet.answerLine}</span> : null}

        {sheet.said ? (
          <figure data-cockpit-said="1" style={{ margin: 0, padding: '8px 10px', borderLeft: `2px solid ${cssVar('call-yours')}`, background: `rgba(var(--ft-teal-rgb), 0.05)` }}>
            <blockquote style={{ margin: 0, fontSize: 13, lineHeight: 1.5, fontStyle: 'italic', color: cssVar('text-secondary') }}>{sheet.said.text}</blockquote>
            <figcaption style={{ marginTop: 4, fontFamily: MONO, fontSize: 9.5, color: cssVar('text-muted') }}>{sheet.said.label}</figcaption>
          </figure>
        ) : null}

        {sheet.facts.length > 0 ? (
          <dl data-cockpit-facts="1" style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {sheet.facts.map((f) => (
              <div key={f.key} data-cockpit-fact={f.key}>
                <dt style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: cssVar('text-muted') }}>{f.label}</dt>
                <dd style={{ margin: '3px 0 0', fontFamily: MONO, fontSize: 12.5 }}>{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {sheet.defaultLine ? <span data-cockpit-default="1" style={{ fontSize: 12.5, color: cssVar('text-secondary') }}>{sheet.defaultLine}</span> : null}

        {sheet.receipts.length > 0 ? (
          <div data-cockpit-receipts="1" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: cssVar('text-muted') }}>{COPY.cockpitSheetReceipts}</span>
            <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {sheet.receipts.map((r) => <li key={r.key} data-cockpit-receipt="1" style={{ fontFamily: MONO, fontSize: 11.5, color: cssVar('text-secondary') }}>{r.text}</li>)}
            </ol>
          </div>
        ) : null}

        {sheet.restated.length > 0 ? (
          <div data-cockpit-restatements="1" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sheet.restated.map((r) => (
              <div key={r.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: cssVar('text-muted') }}>{r.check}</span>
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
            style={{ all: 'unset', cursor: 'pointer', alignSelf: 'flex-start', minHeight: 28, fontFamily: MONO, fontSize: 11, fontWeight: 600, color: cssVar('teal') }}
          >
            <span>{sheet.checkLink.label}</span>
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
