// src/screens/battleView/WhyPanel.intraday.render.test.jsx — contract §9.1: the diagnostic block.
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import WhyPanel from './WhyPanel.jsx';
import { selectWhyState } from './selectWhyState';
import { BATTLE_VIEW_COPY } from './battleViewCopy';
import { INTRADAY_DIAGNOSTIC_HEADER } from '../../data/intradayDiagnosticCopy';

const LAST = '2026-09-17T17:52:02.000Z';
const HELD = { evalId: 'eval_3', timestamp: LAST, decision: 'HOLD', rationale: 'SLB holds.', triggers: ['scheduled'] };
const T = Date.UTC(2026, 8, 17, 17, 52, 0);
const VIEW = {
  evalId: 'eval_3',
  symbols: {
    SLB: {
      price: { value: 493.9, priceAsOf: T },
      indicators: {
        vwap: { status: 'ready', value: 493.12, experimental: true, estimateCutoff: null, verdict: { state: 'display_only', reason: 'cutoff_unconfirmed', consumer: 'display' } },
        macd5m: { status: 'completed', value: { line: 0.4, signal: 0.09, hist: 0.31 }, cutoff: T + 8 * 60_000, verdict: { state: 'eligible', reason: null, consumer: 'display' } },
        sma20_5m: { status: 'absent', value: null, verdict: { state: 'ineligible', reason: 'warmup', consumer: 'display' } },
      },
    },
  },
};
const strip = (h) => h.replace(/<!-- -->/g, '');
const renderRow = (over = {}) => strip(renderToString(<WhyPanel symbol="SLB" state={selectWhyState(HELD, 'SLB', LAST)} onAskFollowUp={() => {}} {...over} />));

describe('§9.1 the diagnostic block on the Why? panel', () => {
  it('renders the fixed header and the copy-table lines from the view, with ET instants', () => {
    const block = BATTLE_VIEW_COPY.intradayDiagnostic(VIEW, 'SLB');
    expect(block[0]).toBe(INTRADAY_DIAGNOSTIC_HEADER);
    expect(block).toContain('VWAP est. 493.12 · cutoff unconfirmed · quote as of 1:52 PM · experimental');
    expect(block).toContain('5m MACD hist +0.31 · completed bars · as of 2:00 PM');
    expect(block).toContain('5m SMA20 unavailable · warming up');
    const html = renderRow({ intradayDiagnostic: block });
    expect(html).toContain('data-intraday="diagnostic"');
    expect(html).toContain('Diagnostic · recorded at the check · not seen by the agent');
    expect(html).toContain('VWAP est. 493.12 · cutoff unconfirmed · quote as of 1:52 PM · experimental');
  });
  it('is absent whole with no view (the default), for a piece the view does not carry, and on the book panel', () => {
    expect(renderRow()).not.toContain('data-intraday');
    expect(BATTLE_VIEW_COPY.intradayDiagnostic(VIEW, 'MU')).toEqual([]);
    expect(BATTLE_VIEW_COPY.intradayDiagnostic(null, 'SLB')).toEqual([]);
    expect(renderRow({ intradayDiagnostic: [] })).not.toContain('data-intraday');
    const book = strip(renderToString(<WhyPanel symbol={null} state={selectWhyState(HELD, null, LAST)} onAskFollowUp={() => {}} intradayDiagnostic={BATTLE_VIEW_COPY.intradayDiagnostic(VIEW, 'SLB')} />));
    expect(book).not.toContain('data-intraday');
  });
});
