// @vitest-environment jsdom
//
// src/screens/battleView/CockpitSheet.jsdom.test.jsx
//
// Cockpit Build 2a — THE SHEET (spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md §7.5;
// ruling R2A-4): a modal bottom sheet on the phone, a modal panel inside the
// pane on desktop; focus moved in, trapped and restored; Escape closes; the
// scroller beneath locked and given back; the agent's own words only when the
// record's saidOk is true; the check link and its missing-card line; the same
// buttons as the tile; the one existing motion token, instant under reduced
// motion.
//
// framer-motion is replaced by a pass-through that records the props the
// sheet hands it, so the motion contract is read off the element rather than
// inferred from timing (jsdom runs no animation).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('framer-motion', async () => {
  const ReactMod = await import('react');
  const pass = (tag) => ReactMod.forwardRef(({ initial, animate, exit, transition, layoutId, ...rest }, ref) => ReactMod.createElement(tag, {
    ref,
    ...rest,
    'data-motion-initial': JSON.stringify(initial ?? null),
    'data-motion-transition': JSON.stringify(transition ?? null),
    ...(layoutId ? { 'data-motion-layout-id': layoutId } : {}),
  }));
  return { motion: { div: pass('div'), span: pass('span') }, AnimatePresence: ({ children }) => children };
});

import CockpitSheet from './CockpitSheet';
import { buildCockpitFeed, sheetOf, eventsByCall } from './cockpitModel';
import { motionToken } from '../../theme/motion';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const T = (iso) => Date.parse(iso);
const NOW = T('2026-09-09T15:05:00.000Z');
const EVALS = [
  { evalId: 'eval_010', promptBuiltAt: '2026-09-09T14:30:20.000Z', evidence: { AMD: { px: 158.4 } } },
  { evalId: 'eval_011', promptBuiltAt: '2026-09-09T14:45:20.000Z' },
];
const CALL = {
  callId: 'b:eval_010:call:0', kind: 'called_shot', evalId: 'eval_010', mintedAt: T('2026-09-09T14:31:00.000Z'), mintedMode: 'on',
  symbol: 'AMD', direction: 'entry', heldAtMint: false, slot: 'support', counterpart: 'KO',
  condition: { side: 'above', level: 161 }, horizon: { phrase: 'this_session', expiresAt: T('2026-09-09T20:00:00.000Z'), basis: 'this_session' },
  defaultAction: 'act', said: 'AMD above $161 by the close.', saidOk: true, evidence: { priceAsOf: '2026-09-09T14:30:20.000Z' },
  state: 'open', stateChangedAt: T('2026-09-09T14:31:00.000Z'), playerResponse: null,
};
const sheetFor = (call = CALL, events = [], outcomes = {}) => {
  const f = buildCockpitFeed({ calls: [call], events, evaluations: EVALS, directive: null, nowMs: NOW, outcomes });
  const tile = [...f.needsYou, ...f.waiting, ...f.earlier][0];
  return sheetOf(tile, { eventsMap: eventsByCall(events), evaluations: EVALS, nowMs: NOW });
};

let container;
let root;
let opener;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  opener = document.createElement('button');
  opener.textContent = 'open';
  document.body.appendChild(opener);
  root = createRoot(container);
  document.body.style.overflow = 'scroll';
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  opener.remove();
  document.body.style.overflow = '';
});

const render = (props) => act(() => { root.render(<CockpitSheet onClose={() => {}} onAnswer={() => {}} onOpenCheck={() => {}} {...props} />); });
const q = (sel) => container.querySelector(sel);
const key = (el, k, opts = {}) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts })); });
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });

describe('§7.5 — a MODAL: labelled, focus in / trapped / back, Escape, scroll lock', () => {
  it('renders nothing without a sheet', () => {
    render({ sheet: null });
    expect(container.innerHTML).toBe('');
  });

  it('role="dialog" aria-modal, labelled by its title — the plain line', () => {
    render({ sheet: sheetFor() });
    const dialog = q('[role="dialog"]');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = document.getElementById(dialog.getAttribute('aria-labelledby'));
    expect(title.textContent).toBe("AMD above $161.00 by today's close");
  });

  it('focus moves into the sheet on open and returns to the opener on close', () => {
    opener.focus();
    render({ sheet: sheetFor() });
    expect(q('[role="dialog"]').contains(document.activeElement)).toBe(true);
    render({ sheet: null });
    expect(document.activeElement).toBe(opener);
  });

  it('Escape closes', () => {
    const onClose = vi.fn();
    render({ sheet: sheetFor(), onClose });
    key(q('[role="dialog"]'), 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab is trapped: from the last control to the first, Shift+Tab from the first to the last', () => {
    render({ sheet: sheetFor() });
    const dialog = q('[role="dialog"]');
    const focusables = [...dialog.querySelectorAll('button:not([disabled])')];
    expect(focusables.length).toBeGreaterThan(1);
    focusables.at(-1).focus();
    key(dialog, 'Tab');
    expect(document.activeElement).toBe(focusables[0]);
    focusables[0].focus();
    key(dialog, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(focusables.at(-1));
  });

  it('PHONE: a bottom sheet fixed to the viewport, its bottom padding clearing the browser chrome (the mark\'s F3 inset)', () => {
    render({ sheet: sheetFor(), isDesktop: false, bottomInset: 34 });
    expect(q('[data-cockpit-sheet-layer]').getAttribute('data-cockpit-sheet-layer')).toBe('mobile');
    expect(q('[data-cockpit-sheet-layer]').style.position).toBe('fixed');
    expect(q('[data-cockpit-sheet]').style.padding).toBe('14px 16px 52px');
  });

  it('DESKTOP: a panel inside the pane (absolute), no chrome inset', () => {
    render({ sheet: sheetFor(), isDesktop: true, bottomInset: 34 });
    expect(q('[data-cockpit-sheet-layer]').style.position).toBe('absolute');
    expect(q('[data-cockpit-sheet]').style.padding).toBe('14px 16px 18px');
  });

  it('THE SHEET WRITES NO STYLE on the body or any scroller — the screen locks its own scroller declaratively (review L4-1, L5-1)', () => {
    render({ sheet: sheetFor(), isDesktop: false });
    expect(document.body.style.overflow).toBe('scroll');
    render({ sheet: null, isDesktop: false });
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('the backdrop and the close button both close', () => {
    const onClose = vi.fn();
    render({ sheet: sheetFor(), onClose });
    click(q('[data-cockpit-sheet-backdrop]'));
    click(q('[data-cockpit-sheet-close]'));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(q('[data-cockpit-sheet-close]').getAttribute('aria-label')).toBe(COPY.cockpitSheetClose);
  });
});

describe('§7.5 — the contents, top to bottom, from records alone', () => {
  it('the agent\'s sentence only when saidOk === true, under "agent\'s own wording (unverified)"', () => {
    render({ sheet: sheetFor() });
    const said = q('[data-cockpit-said]');
    expect(said.textContent).toContain('AMD above $161 by the close.');
    expect(said.textContent).toContain("agent's own wording (unverified)");
    render({ sheet: sheetFor({ ...CALL, saidOk: false }) });
    expect(q('[data-cockpit-said]')).toBeNull();
    expect(container.textContent).not.toContain('AMD above $161 by the close.');
  });

  it('facts, the default as an intent, receipts oldest first (by the check each names)', () => {
    const c = { ...CALL, playerResponse: { kind: 'directive', answer: 'hold', callId: CALL.callId, directiveThreadId: 'th', filedAt: '2026-09-09T14:33:00.000Z', heardEvalId: 'eval_011' } };
    const events = [
      { kind: 'heard', at: T('2026-09-09T14:46:00.000Z'), callIds: [c.callId], evidence: { evalId: 'eval_011', promptBuiltAt: '2026-09-09T14:45:20.000Z' } },
      { kind: 'answered', at: T('2026-09-09T14:33:00.000Z'), callIds: [c.callId] },
    ];
    render({ sheet: sheetFor(c, events) });
    expect([...container.querySelectorAll('[data-cockpit-fact] dd')].map((d) => d.textContent)).toEqual(['above $161.00', "by today's close", '$158.40 · as of the 10:30 AM check']);
    expect(q('[data-cockpit-default]').textContent).toBe('If you say nothing · intent: bring in AMD for KO');
    expect([...container.querySelectorAll('[data-cockpit-receipt]')].map((r) => r.textContent)).toEqual(['Filed 10:33 AM', 'Heard at the 10:45 AM check']);
  });

  it('"From the {t} check →" hands the check\'s evalId to the screen; the missing-card line shows when the screen says so', () => {
    const onOpenCheck = vi.fn();
    render({ sheet: sheetFor(), onOpenCheck });
    const link = q('[data-cockpit-check-link]');
    expect(link.textContent).toBe('From the 10:30 AM check →');
    click(link);
    expect(onOpenCheck).toHaveBeenCalledWith('eval_010');
    expect(q('[data-cockpit-check-gone]')).toBeNull();
    render({ sheet: sheetFor(), onOpenCheck, checkGoneLine: COPY.cockpitSheetCheckGone });
    expect(q('[data-cockpit-check-gone]').textContent).toBe('That check is no longer in the chat');
    expect(q('[data-cockpit-check-gone]').getAttribute('role')).toBe('status');
  });

  it('the same buttons as the tile; a refusal line in a polite live region, the one the model chose from the body', () => {
    const onAnswer = vi.fn();
    render({ sheet: sheetFor(CALL, [], { [CALL.callId]: { status: 403, body: { error: 'forbidden' }, at: NOW, callId: CALL.callId } }), onAnswer });
    expect([...container.querySelectorAll('[data-cockpit-answer]')].map((b) => b.textContent)).toEqual(['Go if it triggers', 'Hold off · 1 message']);
    click(q('[data-cockpit-answer="go"]'));
    expect(onAnswer).toHaveBeenCalledWith(CALL.callId, 'go');
    const region = q('[data-cockpit-sheet-refusal]');
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe("Only the battle's owner can answer its calls.");
  });

  it('an upside call\'s sheet has no default line and no buttons', () => {
    render({ sheet: sheetFor({ ...CALL, heldAtMint: true }) });
    expect(q('[data-cockpit-default]')).toBeNull();
    expect(container.querySelectorAll('[data-cockpit-answer]')).toHaveLength(0);
    expect(container.textContent).toContain('Upside call');
  });
});

describe('R2A-4 — the one existing motion token; instant under reduced motion', () => {
  it('enters on `smooth`', () => {
    render({ sheet: sheetFor(), reducedMotion: false });
    const panel = q('[data-cockpit-sheet]');
    expect(JSON.parse(panel.getAttribute('data-motion-transition'))).toEqual(JSON.parse(JSON.stringify(motionToken('smooth'))));
    expect(JSON.parse(panel.getAttribute('data-motion-initial'))).toEqual({ opacity: 0, y: 24 });
  });
  it('reduced motion: no entrance (initial false) and the instant transition', () => {
    render({ sheet: sheetFor(), reducedMotion: true });
    const panel = q('[data-cockpit-sheet]');
    expect(JSON.parse(panel.getAttribute('data-motion-transition'))).toEqual(JSON.parse(JSON.stringify(motionToken('smooth', { reducedMotion: true }))));
    expect(JSON.parse(panel.getAttribute('data-motion-initial'))).toBe(false);
  });
});

describe('focus that never falls to <body> (review L4-3, L5-5)', () => {
  it('no aria-roledescription: the dialog announces as a dialog, named by its title', () => {
    render({ sheet: sheetFor() });
    expect(q('[role="dialog"]').hasAttribute('aria-roledescription')).toBe(false);
  });

  it('a focus the page LOST while the sheet is open (an answered tile\'s buttons disappearing) comes back into the sheet', () => {
    render({ sheet: sheetFor() });
    act(() => { document.activeElement.blur(); });
    expect(document.activeElement).toBe(document.body);
    render({ sheet: sheetFor() }); // the next record lands
    expect(q('[role="dialog"]').contains(document.activeElement)).toBe(true);
  });

  it('Escape and Tab from a lost focus still work: Escape closes, Tab enters the sheet', () => {
    const onClose = vi.fn();
    render({ sheet: sheetFor(), onClose });
    act(() => { document.activeElement.blur(); });
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); });
    expect(q('[role="dialog"]').contains(document.activeElement)).toBe(true);
    act(() => { document.activeElement.blur(); });
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab and Shift+Tab from the dialog element itself stay inside', () => {
    render({ sheet: sheetFor() });
    const dialog = q('[role="dialog"]');
    const focusables = [...dialog.querySelectorAll('button:not([disabled])')];
    act(() => { dialog.focus(); });
    key(dialog, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(focusables.at(-1));
    act(() => { dialog.focus(); });
    key(dialog, 'Tab');
    expect(document.activeElement).toBe(focusables[0]);
  });

  it('on close, focus goes back to the opener when it can take it; else to the screen\'s fallback (the regrouped tile), never <body>', () => {
    const fallback = document.createElement('button');
    document.body.appendChild(fallback);
    opener.focus();
    render({ sheet: sheetFor(), restoreFocus: () => fallback });
    opener.remove(); // the tile regrouped: its opener is gone
    render({ sheet: null, restoreFocus: () => fallback });
    expect(document.activeElement).toBe(fallback);
    fallback.remove();
  });

  it('an opener inside a HIDDEN panel (the pane moved to Chat for the check link) is not focused; the fallback is', () => {
    const hiddenPanel = document.createElement('div');
    hiddenPanel.hidden = true;
    const inner = document.createElement('button');
    hiddenPanel.appendChild(inner);
    document.body.appendChild(hiddenPanel);
    const fallback = document.createElement('button');
    document.body.appendChild(fallback);
    inner.focus();
    render({ sheet: sheetFor(), restoreFocus: () => fallback });
    render({ sheet: null, restoreFocus: () => fallback });
    expect(document.activeElement).toBe(fallback);
    hiddenPanel.remove();
    fallback.remove();
  });

  it('the check link sizes its own span (hazard 48: index.css forces every <button> to 16 px)', () => {
    render({ sheet: sheetFor() });
    const span = q('[data-cockpit-check-link] span');
    expect(span.style.fontSize).toBe('11px');
    expect(parseInt(q('[data-cockpit-check-link]').style.minHeight, 10)).toBeGreaterThanOrEqual(36);
  });
});
