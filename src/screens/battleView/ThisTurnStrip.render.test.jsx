// src/screens/battleView/ThisTurnStrip.render.test.jsx
//
// Phase A (A3) — This turn holds only the unresolved, check-bound item (the
// current directive), stamps it with the filing exchange's time, promises
// nothing about the next check, and empties when the battle is complete.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ThisTurnStrip from './ThisTurnStrip.jsx';
import { deriveReceipts } from './deriveReceipts';

const T1 = '2026-09-01T15:31:00.000Z'; // 11:31 AM ET
// createdAt is planted in a DIFFERENT minute from the filing exchange, so a
// strip that read directive.createdAt would render 11:33, not 11:31 (T7).
const DIRECTIVE = { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1', createdAt: '2026-09-01T15:33:00.000Z' };
const EXCHANGES = [
  { userMessage: 'protect the lead', agentResponse: 'Got it.', hasDirective: true, directive: { text: DIRECTIVE.text, expiry: 'end_of_battle', directiveThreadId: 't-1' }, directiveThreadId: 't-1', timestamp: T1 },
];
const TURN = { nextDecisionAt: '2026-09-01T17:02:00.000Z' };

const strip = (h) => h.replace(/<!-- -->/g, '');
const render = (props) => strip(renderToString(<ThisTurnStrip {...props} />));

describe('ThisTurnStrip', () => {
  it('a filed directive: `Filed {t}` from the EXCHANGE timestamp, plus the text — no promise about the next check', () => {
    const html = render({ directive: DIRECTIVE, receipts: deriveReceipts(EXCHANGES, DIRECTIVE, 'active'), battleStatus: 'active', turn: TURN });
    expect(html).toContain('Filed 11:31 AM');
    expect(html).not.toContain('11:33');
    expect(html).toContain('Protect the lead into the close');
    expect(html).toContain('data-this-turn="filed"');
    expect(html).not.toContain('for the');
    expect(html).not.toContain('1:02');
  });

  it('empty: `Nothing queued · next check ~{t}` with the adapter\'s next', () => {
    const html = render({ directive: null, receipts: {}, battleStatus: 'active', turn: TURN });
    expect(html).toContain('Nothing queued · next check ~1:00 PM');
    expect(html).toContain('data-this-turn="empty"');
  });

  it('empty with no honest next (late, closed): `Nothing queued` alone', () => {
    const html = render({ directive: null, receipts: {}, battleStatus: 'active', turn: { nextDecisionAt: null } });
    expect(html).toContain('Nothing queued');
    expect(html).not.toContain('next check');
  });

  it('battle complete → the strip empties entirely', () => {
    expect(render({ directive: DIRECTIVE, receipts: deriveReceipts(EXCHANGES, DIRECTIVE, 'completed'), battleStatus: 'completed', turn: TURN })).toBe('');
  });

  it('a directive whose filing exchange is missing still shows Filed, without inventing a time', () => {
    const html = render({ directive: DIRECTIVE, receipts: {}, battleStatus: 'active', turn: TURN });
    expect(html).toContain('>Filed<');
    expect(html).not.toContain('11:31');
  });

  it('names the strip and nothing else — no agent verb', () => {
    const html = render({ directive: DIRECTIVE, receipts: deriveReceipts(EXCHANGES, DIRECTIVE, 'active'), battleStatus: 'active', turn: TURN }).toLowerCase();
    expect(html).toContain('this turn');
    for (const term of ['watching', 'thinking', 'analyzing', 'about to', 'considering', 'heard']) {
      expect(html).not.toContain(term);
    }
  });
});
