// src/components/Agent/AgentChat.research.render.test.jsx
//
// Phase C §3 — THE CARD IN THE TIMELINE. The component and the derivation are
// tested apart; this is the join between them, which is where a card would
// silently render as an empty speech bubble or not render at all.
//
// The repo's component-test idiom: renderToString + toContain
// (TurnLine.render.test.jsx, AgentChat.tapeKinds.render.test.jsx).

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('../../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
vi.mock('./LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

import AgentChat from './AgentChat';

const T = (hhmm) => `2026-09-01T${hhmm}:00.000Z`;

const CARD = {
  symbol: 'MPC',
  eyebrow: 'Research',
  platformDataLabel: 'Platform data · not what the check saw',
  technicals: { facts: ['RSI 62.4 · neutral'], label: 'Technicals · last quote 10:00 AM · daily indicators as of Sep 8' },
  fundamentals: { facts: ['P/E 14.2 · sector median 19.6'], label: 'Fundamentals · as of Sep 5' },
  standing: { place: 'bench', line: 'On the bench', facts: [] },
  equip: false,
};

const RESEARCH = {
  messageType: 'research',
  researchId: 'r-1',
  symbol: 'MPC',
  card: CARD,
  agentResponse: '',
  suggestedActions: null,
  timestamp: T('15:00'),
};

const TYPED = { userMessage: 'how are we doing?', agentResponse: 'The record shows the 11:15 check held.', timestamp: T('14:00') };

const render = (chatExchanges) => renderToString(
  <AgentChat
    battleId="battle-1"
    agentId="agent-1"
    agentName="Vega"
    chatExchanges={chatExchanges}
    battleStatus="active"
    statusFeed={[]}
    knownTickers={new Set(['MPC', 'NVDA'])}
  />,
);

describe('the research card in the chat timeline', () => {
  const html = render([TYPED, RESEARCH]);

  it('renders the card, its sections and its provenance lines', () => {
    expect(html).toContain('data-research-card="MPC"');
    expect(html).toContain('RSI 62.4');
    expect(html).toContain('P/E 14.2');
    expect(html).toContain('Technicals · last quote 10:00 AM · daily indicators as of Sep 8');
    expect(html).toContain('Fundamentals · as of Sep 5');
    expect(html).toContain('On the bench');
  });

  it('carries the platform-data label ON the card', () => {
    expect(html).toContain('data-research-platform-label');
    expect(html).toContain('Platform data · not what the check saw');
  });

  it('renders NO empty speech bubble for it (the `directive_filed` rule)', () => {
    // COUNTED, not eyeballed: the narrator bubble is the only element carrying
    // the bubble background, so one typed exchange plus one card must produce
    // exactly ONE. Dropping `|| message._research` from the skip adds a second,
    // empty, bordered bubble above every card — a mutation an assertion on the
    // card's own markup cannot see (review F-6).
    const bubbles = (h) => (h.match(/background:#15171E/g) || []).length;
    expect(bubbles(html)).toBe(1);
    expect(bubbles(render([TYPED]))).toBe(1);
    expect(bubbles(render([TYPED, RESEARCH, RESEARCH]))).toBe(1);
  });

  it('wears no kind eyebrow beside the card’s own', () => {
    expect(html.split('Research').length - 1).toBe(1);
    expect(html).not.toContain('data-tape-kind-eyebrow="Research"');
  });

  it('does not invent a user bubble for a card nobody typed', () => {
    expect(html.split('how are we doing?').length - 1).toBe(1); // the typed one only
  });

  it('leaves the ordinary exchange rendering exactly as it did', () => {
    expect(html).toContain('The record shows the 11:15 check held.');
    expect(render([TYPED])).toContain('The record shows the 11:15 check held.');
  });

  it('a battle with no card renders no card markup at all', () => {
    expect(render([TYPED])).not.toContain('data-research-card');
  });
});
