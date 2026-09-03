// src/components/Agent/AgentChat.tapeKinds.render.test.jsx
//
// D-84 — the tape's FOUR visual kinds, in one stream, on the real component.
//
// Under the flag the conversation carries four things that are not the same
// kind of thing, and a player has to be able to tell them apart without
// reading a word:
//
//   1. character speech      the shipped left bubble — a fill and a TAIL (the
//                            square top-left corner of `0 12px 12px 12px`)
//   2. the player's messages the shipped right bubble — a fill and a tail at
//                            the bottom-right (`12px 12px 0 12px`)
//   3. engine records        FLAT: `background:transparent`, `border-radius:0`,
//                            a 2px left edge from a token, a mono eyebrow, and
//                            the first sentence with `Read more`
//   4. directive cards       the shipped ExecutionCard under `Directive`
//
// The rows below assert the DISTINCTION, not the decoration: every kind is
// checked for the markers of its own class AND against the markers of the
// others, so a record that grew a bubble — the defect D-84 exists to
// prevent — reds a row.
//
// Nothing in the shipped bubbles or the shipped card changed for this: the
// distinctions are read off the markup those components already emit, which
// is why the flag-off goldens are untouched by this phase.
//
// renderToString (effects do not run): the markup is the whole claim.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('../../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
vi.mock('./LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

import AgentChat from './AgentChat';
import { buildTape } from '../../screens/battleView/buildTape';
import { deriveReceipts } from '../../screens/battleView/deriveReceipts';

const T = (hhmm) => `2026-09-01T${hhmm}:00.000Z`;

const EXCHANGES = [
  { userMessage: '', agentResponse: 'Opening the book with energy leadership.', timestamp: T('13:31') },
  {
    userMessage: 'protect the lead', agentResponse: 'Understood.', hasDirective: true,
    directive: { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1' },
    directiveThreadId: 't-1', timestamp: T('15:31'),
  },
];
const DIRECTIVE = { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1', createdAt: T('15:31') };

const TRADES = [{
  symbolOut: 'GILD', symbolIn: 'MOS', tier: 'core', lockedPoints: 8.04,
  swappedOutAt: T('17:31'), evaluationId: 'eval_009', source: 'haiku',
  rationale: 'GILD has stalled at the 200-day. MOS is breaking out on volume, so the core slot rotates.',
}];
const EVALUATIONS = [{
  evalId: 'eval_046', timestamp: T('19:46'), decision: 'HOLD', downgraded: false,
  rationale: 'The book is holding its shape. Nothing in the tape argues for a rotation yet.',
  scores: { active: 12, banked: 40, total: 52 },
}];

const receipts = deriveReceipts(EXCHANGES, DIRECTIVE, 'active');
const tapeEntries = buildTape({
  trades: TRADES, statusFeed: [], evaluations: EVALUATIONS, receipts, chatExchanges: EXCHANGES,
});

const BASE = {
  battleId: 'ab-1', agentId: 'agent-1', agentName: 'Aurora',
  chatExchanges: EXCHANGES, battleStatus: 'active', statusFeed: [], trades: [],
  knownTickers: new Set(),
};
const strip = (h) => h.replace(/<!-- -->/g, '');
const render = (props = {}) => strip(renderToString(
  <AgentChat {...BASE} receipts={receipts} tapeEntries={tapeEntries} {...props} />,
));

// The record shell, as the four rows below all read it.
const RECORD_SHELL = 'background:transparent;border-radius:0;border-left:2px solid var(--ft-';
const MONO = 'font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

describe('D-84 — four kinds in one stream', () => {
  it('KIND 1 — character speech keeps the shipped bubble: a fill and a tail', () => {
    const html = render();
    expect(html).toContain('border-radius:0 12px 12px 12px');
    expect(html).toContain('Opening the book with energy leadership.');
    // The agent's name rides the bubble, in the body face, never in mono.
    expect(html).toContain('>Aurora<');
  });

  it('KIND 2 — the player\'s message keeps the shipped right bubble and its own tail', () => {
    const html = render();
    expect(html).toContain('border-radius:12px 12px 0 12px');
    expect(html).toContain('protect the lead');
  });

  it('KIND 3 — an engine record is FLAT: no fill, no radius, a token edge, a mono eyebrow', () => {
    const html = render();
    for (const kind of ['trade', 'check']) {
      const card = html.slice(html.indexOf(`data-tape-kind="${kind}"`));
      expect(card).toContain(RECORD_SHELL);
      // …the eyebrow is mono, and it is the FIRST thing in the record.
      expect(card.slice(0, card.indexOf('</div>') + 600)).toContain(MONO);
    }
    // The record's own lines are present…
    expect(html).toContain('1:31 PM · GILD → MOS · Core');
    expect(html).toContain('At the 3:45 PM check · Held');
    // …and NEITHER bubble's shell is anywhere near them.
    const records = html.slice(html.indexOf('data-tape-kind="trade"'));
    expect(records).not.toContain('border-radius:0 12px 12px 12px');
    expect(records).not.toContain('border-radius:12px 12px 0 12px');
    expect(records).not.toContain('background:var(--ft-bg-card)');
  });

  it('KIND 3 — a record shows ONE sentence and a `Read more`, never the whole paragraph', () => {
    const html = render();
    expect(html).toContain('GILD has stalled at the 200-day.');
    expect(html).not.toContain('MOS is breaking out on volume, so the core slot rotates.');
    expect(html).toContain('The book is holding its shape.');
    expect(html).not.toContain('Nothing in the tape argues for a rotation yet.');
    // One door per record.
    expect((html.match(/>Read more</g) || []).length).toBe(2);
  });

  it('KIND 4 — the directive card is the shipped card under the `Directive` eyebrow', () => {
    const html = render();
    expect(html).toContain('>Directive<');
    expect(html).toContain('Protect the lead into the close');
    expect(html).toContain('data-receipt="filed"');
    expect(html).not.toContain('DIRECTIVE LOCKED IN');
    // A directive card is not a record: it keeps its radius.
    expect(html).not.toMatch(/data-receipt="filed"[^>]*>[\s\S]{0,200}border-radius:0;/);
  });

  it('MUTATION ROW — the four shells are four DIFFERENT shells', () => {
    const html = render();
    const shells = [
      'border-radius:0 12px 12px 12px', // speech
      'border-radius:12px 12px 0 12px', // the player
      RECORD_SHELL,                     // records
      '>Directive<',                    // the directive card
    ];
    for (const shell of shells) expect(html).toContain(shell);
    expect(new Set(shells).size).toBe(4);
  });

  it('the record family is one family — the collapsed run wears the same shell', () => {
    const quiet = [
      { ...EVALUATIONS[0], evalId: 'e1', timestamp: T('19:31') },
      { ...EVALUATIONS[0], evalId: 'e2', timestamp: T('19:46') },
    ];
    const html = render({
      tapeEntries: buildTape({ trades: [], statusFeed: [], evaluations: quiet, receipts, chatExchanges: EXCHANGES }),
    });
    const run = html.slice(html.indexOf('data-tape-kind="checkRun"'));
    expect(run).toContain('2 checks · no change');
    expect(run).toContain(RECORD_SHELL);
    expect(run).toContain(MONO);
  });

  it('FLAG OFF — no record renders at all, and the bubbles are untouched', () => {
    const html = strip(renderToString(<AgentChat {...BASE} />));
    expect(html).not.toContain('data-tape-kind');
    expect(html).not.toContain(RECORD_SHELL);
    expect(html).toContain('border-radius:0 12px 12px 12px');
    expect(html).toContain('border-radius:12px 12px 0 12px');
    expect(html).toContain('DIRECTIVE LOCKED IN');
  });
});
