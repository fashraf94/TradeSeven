// src/screens/battleView/TurnLine.render.test.jsx
//
// Phase A (A1) — the turn line renders the derived text and nothing else: no
// countdown, no verb, and the decided mark hidden from assistive tech.
// renderToString + toContain, the repo's component-test idiom.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import TurnLine from './TurnLine.jsx';
import { TURN_STATE } from './deriveTurnLine';

const TURN = {
  phase: 'LIVE',
  state: TURN_STATE.LIVE,
  text: 'Checked 12:47 PM · next ~1:02 PM',
  lastCheckedAt: '2026-09-01T16:47:00.000Z',
  nextDecisionAt: '2026-09-01T17:02:00.000Z',
  dueAt: '2026-09-01T17:02:00.000Z',
  decided: true,
  decision: { evalId: 'eval_005' },
};

const render = (turn, props = {}) => renderToString(<TurnLine turn={turn} {...props} />);

describe('TurnLine', () => {
  it('renders the derived text verbatim', () => {
    expect(render(TURN)).toContain('Checked 12:47 PM · next ~1:02 PM');
  });

  it('renders nothing without a turn (flag-off hands the header null)', () => {
    expect(render(null)).toBe('');
  });

  it('the decided mark is decorative — aria-hidden, keyed by data attribute', () => {
    expect(render(TURN)).toContain('data-decided="true"');
    expect(render({ ...TURN, decided: false, decision: null })).toContain('data-decided="false"');
    expect(render(TURN)).toContain('aria-hidden="true"');
  });

  it('announces politely — the landing is the one moment a screen reader should hear', () => {
    expect(render(TURN)).toContain('aria-live="polite"');
  });

  it('carries no per-second countdown: the text is the whole clock', () => {
    const html = render(TURN);
    expect(html).not.toMatch(/\d+\s*(s|sec|seconds)\b/);
    expect(html).not.toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it('exposes the state for the layout to key on', () => {
    expect(render({ ...TURN, state: TURN_STATE.LATE, text: 'Last check 12:47 PM · next was due ~1:02 PM' }))
      .toContain('data-turn-state="late"');
  });
});
