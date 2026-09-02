// src/components/Agent/AgentChat.receipts.render.test.jsx
//
// Phase A (A3, D-60) — under the controller flag the directive card carries a
// RECEIPT (`Filed {t}` / `Replaced {t}` / `Expired`) and nothing that pulses or
// promises; flag-off (no receipts map) the card is the shipped one, byte for
// byte — `Executing on next evaluation window` and the pulse stay until their
// own PR after Phase A (bug 2).
//
// renderToString (effects do not run): the card's markup is the whole claim.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('../../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
vi.mock('./LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

import AgentChat from './AgentChat';
import { deriveReceipts } from '../../screens/battleView/deriveReceipts';

const T1 = '2026-09-01T15:31:00.000Z'; // 11:31 AM ET
const T2 = '2026-09-01T16:58:00.000Z'; // 12:58 PM ET
const EXCHANGES = [
  {
    userMessage: 'protect the lead', agentResponse: 'Got it.', hasDirective: true,
    directive: { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1' },
    directiveThreadId: 't-1', timestamp: T1,
  },
  {
    userMessage: 'actually lean into tech', agentResponse: 'Understood.', hasDirective: true,
    directive: { text: 'Lean into tech strength', expiry: 'end_of_battle', directiveThreadId: 't-2' },
    directiveThreadId: 't-2', timestamp: T2,
  },
];
const DIRECTIVE = { text: 'Lean into tech strength', expiry: 'end_of_battle', directiveThreadId: 't-2', createdAt: T2 };

const BASE = {
  battleId: 'ab-1', agentId: 'agent-1', agentName: 'Aurora',
  chatExchanges: EXCHANGES, battleStatus: 'active', statusFeed: [], trades: [], knownTickers: new Set(),
};
const strip = (h) => h.replace(/<!-- -->/g, '');
const render = (props) => strip(renderToString(<AgentChat {...BASE} {...props} />));

describe('under the flag — receipts on the directive cards', () => {
  it('the first card reads `Replaced 12:58 PM`, the second `Filed 12:58 PM`; the promise and the pulse are gone', () => {
    const html = render({ receipts: deriveReceipts(EXCHANGES, DIRECTIVE, 'active') });
    expect(html).toContain('Replaced 12:58 PM');
    expect(html).toContain('Filed 12:58 PM');
    expect(html).toContain('data-receipt="replaced"');
    expect(html).toContain('data-receipt="filed"');
    expect(html).not.toContain('Executing on next evaluation window');
    // The shipped pulse is three 4px dots; none render under the flag.
    expect(html).not.toContain('width:4px;height:4px');
    // The shipped label and the text still render — receipts sit beside them.
    expect(html).toContain('DIRECTIVE LOCKED IN');
    expect(html).toContain('Protect the lead into the close');
  });

  it('battle complete → the current card reads `Expired`; the replaced one keeps `Replaced {t}` (F11)', () => {
    const html = render({ receipts: deriveReceipts(EXCHANGES, DIRECTIVE, 'completed'), battleStatus: 'completed' });
    expect((html.match(/data-receipt="expired"/g) || []).length).toBe(1);
    expect(html).toContain('>Expired<');
    expect(html).toContain('Replaced 12:58 PM');
    expect(html).not.toContain('Filed');
  });

  it('a directive card whose exchange carries no thread id gets no line at all — never the promise', () => {
    const legacy = [{ userMessage: 'x', agentResponse: 'y', hasDirective: true, directive: { text: 'Old-style directive', expiry: 'end_of_battle' }, timestamp: T1 }];
    const html = render({ chatExchanges: legacy, receipts: deriveReceipts(legacy, null, 'active') });
    expect(html).toContain('Old-style directive');
    expect(html).not.toContain('data-receipt');
    expect(html).not.toContain('Executing on next evaluation window');
  });

  it('the vocabulary is D-51 — no Heard, Holding, Declined, Honored, Superseded', () => {
    const html = render({ receipts: deriveReceipts(EXCHANGES, DIRECTIVE, 'active') });
    for (const word of ['Heard', 'Holding', 'Declined', 'Honored', 'Superseded']) {
      expect(html).not.toContain(word);
    }
  });
});

describe('flag-off — the shipped card, unchanged', () => {
  it('with no receipts map the promise and the pulse render exactly as shipped', () => {
    const html = render({});
    expect((html.match(/Executing on next evaluation window/g) || []).length).toBe(2);
    expect(html).not.toContain('data-receipt');
    expect(html).not.toContain('Replaced');
    expect(html).not.toContain('Filed');
  });
});
