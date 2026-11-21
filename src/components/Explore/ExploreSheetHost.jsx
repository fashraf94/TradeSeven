// src/components/Explore/ExploreSheetHost.jsx
//
// Explore Build 1 — THE HOST OF THE WORK AN IDEA SHEET (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md
// §3.6; build prompt K-8, K-9). In the pattern of the hub's wrapper and its sheet (copied in shape, never
// imported: Explore imports nothing from the hub):
//   - a dialog 720 wide on a wide screen, a full-height bottom sheet on a phone, portalled into <body>;
//   - while open, every other child of <body> is inert (the app's root with the page, its nav and the pinned bar),
//     and exactly what was marked is released on close; the page stays MOUNTED behind, so its scroll position,
//     its chosen question and its edits survive;
//   - focus moves to Close on open and back to the control that opened it on close (`opener`, captured at the tap),
//     else to `fallbackFocus()`; never scrolling the page (`preventScroll`); Escape closes; Tab stays inside;
//   - the body is loaded lazily through ./loadSharedResearch.js (the sheet's second door) inside Suspense and an
//     error boundary with the hub wrapper's three lines: loading, a failed load with Try again (a fresh import), and
//     the same line for a body that throws;
//   - the body mounts fresh for each opening (`key` is the opening's id), standalone: `overlayStack` null,
//     `stories` [], and no agent (no source outside the hub has it without a new read: spec §3.6, preamble 6).
//
// THE FOUR WAYS IN (spec §3.6's table, exactly):
//   work      mode 'item', startNow, item = the story with the question as edited
//   continue  mode 'session', sessionId = the read's open.sessionId — never a new open (K-9)
//   view      mode 'session', sessionId = the read's last.sessionId
//   words     mode 'start', words = the typed text; nothing is sent until the player continues in the sheet

import React, { Component, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { motionToken } from '../../theme/motion';
import { loadSharedResearch } from './loadSharedResearch';
import { EXPLORE_COPY } from './exploreCopy';
import { EXPLORE_LAYERS, S, T, btnStyle, wash } from './exploreStyle';
import { Icon, LinkBtn, StatusLine } from './exploreParts';

const COPY = EXPLORE_COPY.sheet;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The body props for one opening (spec §3.6's table). `entry`: { id, way, item?, sessionId?, words? }. */
export function bodyPropsOf(entry) {
  if (entry.way === 'work') return { mode: 'item', item: entry.item, startNow: true };
  if (entry.way === 'continue' || entry.way === 'view') return { mode: 'session', sessionId: entry.sessionId };
  return { mode: 'start', words: entry.words };
}

/**
 * The body's lazy component and its retries, over `load` (copied in shape from the hub wrapper's createBodyLoader).
 * `retry()` runs a fresh load and swaps in a new lazy only once it has loaded; calls while one is out share it.
 */
export function createBodyLoader(load) {
  const attempt = () => new Promise((resolve) => { resolve(load()); });
  let Body = lazy(attempt);
  let pending = null;
  return {
    current: () => Body,
    retry() {
      if (!pending) {
        pending = attempt()
          .then((module) => { Body = lazy(() => Promise.resolve(module)); })
          .finally(() => { pending = null; });
      }
      return pending;
    },
  };
}

class BodyBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The failed load's line and Try again (the line is the alert, keyed per failure so each is announced). */
function LoadFailed({ onTryAgain, retrying, failures }) {
  return (
    <div data-explore-sheet-load-failed={retrying ? 'retrying' : ''} style={{ ...S.row, gap: 10 }}>
      <span key={failures} role="alert" style={{ ...S.body, color: T.ink2 }}>{COPY.loadFailed}</span>
      <LinkBtn aria-disabled={retrying ? 'true' : undefined} onClick={retrying ? undefined : onTryAgain}>{COPY.tryAgain}</LinkBtn>
      {retrying && <StatusLine>{COPY.loading}</StatusLine>}
    </div>
  );
}

/**
 * Marks every child of <body> but `keep` inert and returns the release, which un-marks exactly what this call
 * marked. An element already inert (someone else's) is left alone, before and after.
 */
export function inertOthers(keep) {
  const marked = [];
  for (const el of Array.from(document.body.children)) {
    if (el === keep || el.hasAttribute('inert')) continue;
    el.setAttribute('inert', '');
    marked.push(el);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const el of marked) el.removeAttribute('inert');
  };
}

const canFocus = (el) => Boolean(el) && typeof el.focus === 'function' && el.isConnected && !el.disabled && !el.closest('[inert]');

/** The host for one body loader; the default export binds the real one, tests bind their own. */
export function createExploreSheetHost(load) {
  const loader = createBodyLoader(load);

  function ExploreSheetHost({ entry, gated = false, phone = false, onClose, opener = null, fallbackFocus = null }) {
    const overlayRef = useRef(null);
    const backdropRef = useRef(null);
    const dialogRef = useRef(null);
    const closeRef = useRef(null);
    const reducedMotion = useReducedMotion() === true;
    const [loads, setLoads] = useState(0);
    const [retrying, setRetrying] = useState(false);
    const [failures, setFailures] = useState(0);

    // A wheel or a drag over the backdrop never scrolls the page behind (review C-6); the dialog contains its own
    // scroll (overscroll-behavior: contain).
    useEffect(() => {
      const el = backdropRef.current;
      if (!el) return undefined;
      const stop = (event) => { event.preventDefault(); };
      el.addEventListener('wheel', stop, { passive: false });
      el.addEventListener('touchmove', stop, { passive: false });
      return () => { el.removeEventListener('wheel', stop); el.removeEventListener('touchmove', stop); };
    }, []);

    useEffect(() => {
      const release = inertOthers(overlayRef.current);
      closeRef.current?.focus({ preventScroll: true });
      return () => {
        release();
        const back = canFocus(opener) ? opener : (typeof fallbackFocus === 'function' ? fallbackFocus() : null);
        if (canFocus(back)) back.focus({ preventScroll: true });
      };
      // The opener and the fallback are the opening's: read once, as the hub's sheet does.
    }, []);

    const onKeyDown = (event) => {
      if (!dialogRef.current?.contains(event.target)) return; // a portal of the body's own (its modal) traps itself
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = dialogRef.current.querySelectorAll(FOCUSABLE);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const inside = [...nodes].includes(document.activeElement);
      if (!inside) {
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

    const tryAgain = () => {
      if (retrying) return;
      setRetrying(true);
      loader.retry().then(
        () => { setRetrying(false); setLoads((n) => n + 1); },
        () => { setRetrying(false); setFailures((n) => n + 1); },
      );
    };

    const Body = loader.current();
    const transition = motionToken('smooth', { reducedMotion });
    return createPortal(
      <div
        ref={overlayRef}
        className="ftx-portal"
        data-explore-sheet-overlay=""
        style={{ position: 'fixed', inset: 0, zIndex: EXPLORE_LAYERS.sheet, display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : 24 }}
      >
        <motion.div
          ref={backdropRef}
          aria-hidden="true"
          data-explore-sheet-backdrop=""
          onClick={onClose}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transition}
          style={{ position: 'absolute', inset: 0, background: wash('shadow', 0.72) }}
        />
        <motion.div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={COPY.label}
          data-explore-sheet={phone ? 'bottom' : 'dialog'}
          onKeyDown={onKeyDown}
          initial={reducedMotion ? false : phone ? { y: '100%' } : { opacity: 0, scale: 0.97 }}
          animate={phone ? { y: 0 } : { opacity: 1, scale: 1 }}
          transition={transition}
          style={{
            position: 'relative', width: '100%', maxWidth: phone ? 'none' : 720, height: phone ? '100%' : 'auto', maxHeight: phone ? '100%' : '90%',
            overflowY: 'auto', overscrollBehavior: 'contain', outline: 'none',
            background: T.bg, border: `1px solid ${T.hair}`, borderRadius: phone ? 0 : 20,
            padding: phone ? '12px 16px calc(28px + env(safe-area-inset-bottom, 0px))' : '20px 24px 24px',
            boxShadow: `0 -20px 60px ${wash('shadow', 0.5)}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.eyebrow}>{COPY.eyebrow}</div>
              <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.015em', margin: '4px 0 0', color: T.ink, lineHeight: 1.3 }}>{COPY.title}</h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={COPY.close}
              data-explore-sheet-close=""
              style={{ ...btnStyle('secondary'), width: 44, height: 44, padding: 0, flexShrink: 0, color: T.ink2 }}
            >
              <Icon name="x" />
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <BodyBoundary key={loads} fallback={<LoadFailed onTryAgain={tryAgain} retrying={retrying} failures={failures} />}>
              <Suspense fallback={<StatusLine>{COPY.loading}</StatusLine>}>
                <Body
                  key={entry.id}
                  open
                  {...bodyPropsOf(entry)}
                  direction={null}
                  stories={[]}
                  agentName={null}
                  agentId={null}
                  equippedListLabel={null}
                  gated={gated}
                  phone={phone}
                  onClose={onClose}
                  overlayStack={null}
                />
              </Suspense>
            </BodyBoundary>
          </div>
        </motion.div>
      </div>,
      document.body,
    );
  }

  return ExploreSheetHost;
}

export default createExploreSheetHost(loadSharedResearch);
