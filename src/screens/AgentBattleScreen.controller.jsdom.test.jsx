// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.controller.jsdom.test.jsx
//
// Review finding T5: the screen → WhyPanel and screen → AgentChat wiring had
// no executable guard (renderToString cannot tap a row, and the chat tab
// never renders on the first paint). This mounts the real screen under the
// controller flag, taps a player row, reads the panel's facts, walks through
// the one door, and reads the receipt on the directive card.
//
// Harness precedent: useLandingKey.test.jsx / AgentChat.prefill.test.jsx
// (jsdom docblock, createRoot + act, per-file mocks, fake timers).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
vi.mock('../contexts/ThemeContext', () => {
  const tokens = new Proxy({}, { get: () => '#000000' });
  return { useTheme: () => ({ tokens }), ThemeProvider: ({ children }) => children };
});
vi.mock('../hooks/useAgentBattleId', () => ({ default: () => ({ agentBattleId: null, loading: false }) }));
vi.mock('../hooks/useWebSocketPrices', () => ({ useWebSocketPrices: () => ({ prices: {}, status: 'disconnected' }) }));
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isAgentPresenceOn: () => false,
  isMatchupsBackdropOn: () => false,
  isBattleViewControllerOn: () => true,
}));
vi.mock('../services/eodhdAPI', () => ({
  stockAPI: {
    getMultipleStockPrices: vi.fn(async () => ({})),
    getMultipleCryptoPrices: vi.fn(async () => ({})),
  },
  POPULAR_CRYPTO: [],
}));
vi.mock('../components/Agent/LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

const LIVE_DOC = {
  id: 'ab-1',
  status: 'active',
  activatedAt: '2026-09-01T13:30:00.000Z',
  agentContext: { agentName: 'Aurora' },
  scoreState: { currentScore: 12, opponentScore: 3, tradeCount: 1, evaluationCount: 5, lastScoredAt: '2026-09-01T16:47:00.000Z' },
  portfolio: {
    star: [{ symbol: 'AAPL' }, { symbol: 'SLB', swapPrice: 34.1, swappedInAt: '2026-09-01T15:02:00.000Z' }],
    core: [{ symbol: 'NVDA' }],
    support: [],
    startingPrices: { AAPL: 150, NVDA: 900, MU: 90 },
  },
  opponent: { portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [] } },
  evaluations: [
    { evalId: 'eval_005', timestamp: '2026-09-01T16:47:02.000Z', decision: 'HOLD', downgraded: true, rationale: 'SLB lost its bid; swap SLB for DVN.', haikuError: null },
  ],
  trades: [
    { symbolOut: 'MU', symbolIn: 'SLB', swappedOutAt: '2026-09-01T15:02:00.000Z', exitReason: 'haiku_decision', rationale: 'MU rolled over; SLB leads energy.' },
  ],
  statusFeed: [],
  chatExchanges: [
    {
      userMessage: 'protect the lead', agentResponse: 'Got it.', hasDirective: true,
      directive: { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1' },
      directiveThreadId: 't-1', timestamp: '2026-09-01T15:31:00.000Z',
    },
  ],
  directive: { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1', createdAt: '2026-09-01T15:33:00.000Z' },
};
vi.mock('../hooks/useAgentBattle', () => ({
  default: () => ({
    battle: LIVE_DOC, statusFeed: [], executionMode: 'copilot', pendingProposal: null,
    strategyPreset: 'balanced', gameplanMeeting: null, chatExchanges: LIVE_DOC.chatExchanges,
    feedBookmarks: [], loading: false,
  }),
}));

import AgentBattleScreen from './AgentBattleScreen';

const BATTLE = {
  agentId: 'agent-1', agentBattleId: 'ab-1',
  creator: { portfolio: { star: [{ symbol: 'AAPL' }, { symbol: 'MU' }], core: [{ symbol: 'NVDA' }], support: [] } },
  opponent: { portfolio: { star: [{ symbol: 'MSFT' }], core: [], support: [] } },
  state: { startingPrices: { AAPL: 150, NVDA: 900, MU: 90 } },
};

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
}

let container;
let root;
beforeEach(() => {
  // Pin the CLOCK only (the turn line's phase reads the wall clock); timers
  // and animation frames stay real so framer's exit animations and the
  // AnimatePresence tab hand-off actually complete.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-01T17:00:00.000Z'));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const mount = () => act(() => {
  root.render(<AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />);
});
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
const settle = (ms = 800) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const rowButtonFor = (symbol) => [...container.querySelectorAll('[role="button"][aria-expanded]')]
  .find((el) => el.querySelector('[data-why-label]') && el.textContent.includes(symbol));

describe('the controller, mounted — the wiring the first paint cannot reach (T5)', () => {
  it('tapping a player row opens Why? with the row\'s own facts and the downgraded state; tapping again closes it', async () => {
    mount();
    const slb = rowButtonFor('SLB');
    expect(slb).toBeTruthy();
    expect(slb.getAttribute('aria-expanded')).toBe('false');
    click(slb);
    const panel = container.querySelector('[data-why-symbol="SLB"]');
    expect(panel).toBeTruthy();
    expect(panel.getAttribute('data-why-kind')).toBe('downgraded');
    expect(panel.textContent).toContain('Argued for a swap · held by a guardrail');
    // A2.1: a ROW's eyebrow says where its sentences came FROM; `At the {t}
    // check` is the book panel's, because that panel IS the whole check.
    expect(panel.textContent).toContain('From the 12:47 PM check');
    expect(panel.textContent).not.toContain('At the 12:47 PM check');
    // A2.1 (ruling 1): the two scoring tiers as prices, from the enriched
    // asset's own thresholdBaseline × (1 ± baseATR/100) — the lift is wired.
    expect(panel.textContent).toMatch(/Bagger \$[\d,]+\.\d{2} · Bust \$[\d,]+\.\d{2}/);
    expect(panel.textContent).toContain('from the scoring path');
    // …and never the two lines with no persisted source (D-78, D-79).
    expect(panel.textContent).not.toContain('Stop $');
    expect(panel.textContent).not.toContain('Alert line');
    // The sentences that name SLB, verbatim — this rationale names it.
    expect(panel.textContent).toContain('SLB lost its bid; swap SLB for DVN.');
    // Facts: the row's number, the enriched asset's entry and held-since.
    expect(panel.textContent).toContain('Entry $34.10');
    expect(panel.textContent).toContain('Held since 11:02 AM');
    expect(panel.textContent).toContain('% to');
    // This piece today, from trades[] — the agent's words, no machinery code.
    expect(panel.textContent).toContain('11:02 AM · MU → SLB');
    expect(panel.textContent).toContain('MU rolled over');
    expect(panel.textContent).not.toContain('haiku_decision');
    expect(panel.textContent.toLowerCase()).not.toContain('lock');
    expect(slb.getAttribute('aria-expanded')).toBe('true');
    click(slb);
    await settle(); // the exit animation
    expect(container.querySelector('[data-why-symbol="SLB"]')).toBeNull();
  });

  it('A4.3 (F16): the row button\'s name is `Why? {symbol}`; its description ids resolve to the price change and the proximity text', () => {
    mount();
    const slb = rowButtonFor('SLB');
    expect(slb.getAttribute('aria-label')).toBe('Why? SLB');
    const ids = slb.getAttribute('aria-describedby').split(' ');
    expect(ids.length).toBe(2);
    const [pct, proximity] = ids.map((id) => document.getElementById(id));
    expect(pct).toBeTruthy();
    expect(proximity).toBeTruthy();
    expect(slb.contains(pct)).toBe(true);
    expect(slb.contains(proximity)).toBe(true);
    expect(pct.textContent).toMatch(/[+-]?\d+\.\d{2}%/);
    expect(proximity.textContent).toContain('% to');
    // The inner symbol / points targets stay out of the tab order (mouse-only, as shipped).
    expect(slb.querySelectorAll('button, [tabindex]').length).toBe(0);
    // The header button is named for the book, not by its numbers.
    const header = [...container.querySelectorAll('[role="button"][aria-expanded]')].find((el) => el.textContent.includes('Aurora') && el.textContent.includes('CPU'));
    expect(header.getAttribute('aria-label')).toBe('Why? · the whole book');
  });

  it('only one row is open at a time; the CPU side never opens', async () => {
    mount();
    click(rowButtonFor('AAPL'));
    expect(container.querySelector('[data-why-symbol="AAPL"]')).toBeTruthy();
    click(rowButtonFor('NVDA'));
    await settle();
    expect(container.querySelector('[data-why-symbol="AAPL"]')).toBeNull();
    expect(container.querySelector('[data-why-symbol="NVDA"]')).toBeTruthy();
    // No CPU-side button exists: the right sides carry no role.
    expect(container.querySelector('[data-why-symbol="AMD"]')).toBeNull();
    expect([...container.querySelectorAll('[role="button"][aria-expanded]')].some((el) => el.textContent.includes('AMD') && el.querySelector('[data-why-label]'))).toBe(false);
  });

  it('the one door prefills the composer with `About SLB — ` in the chat column, whose card carries the receipt (D-60)', async () => {
    mount();
    click(rowButtonFor('SLB'));
    const door = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Ask a follow-up · 1 message');
    expect(door).toBeTruthy();
    click(door);
    await settle(200); // A4: the desktop chat column is always mounted — no tab hand-off
    const textarea = container.querySelector('textarea');
    expect(textarea).toBeTruthy();
    expect(textarea.value).toBe('About SLB — ');
    expect(document.activeElement).toBe(textarea);
    // The directive card: receipt line, no promise, no pulse.
    expect(container.querySelector('[data-receipt="filed"]')).toBeTruthy();
    expect(container.textContent).toContain('Filed 11:31 AM');
    expect(container.textContent).not.toContain('Executing on next evaluation window');
  });

  it('the score header opens the book panel — the decision and the door; This turn has ONE home, above the board (A4)', () => {
    mount();
    const header = [...container.querySelectorAll('[role="button"][aria-expanded]')].find((el) => el.textContent.includes('Aurora') && el.textContent.includes('CPU'));
    expect(header).toBeTruthy();
    click(header);
    const book = container.querySelector('[data-why-symbol="book"]');
    expect(book).toBeTruthy();
    expect(book.textContent).toContain('At the 12:47 PM check');
    expect(book.querySelector('[data-this-turn]')).toBeNull();
    expect(container.querySelectorAll('[data-this-turn]').length).toBe(1);
    expect(book.textContent).not.toContain('Entry $');
    expect(book.textContent).toContain('Ask a follow-up · 1 message');
  });

  it('the turn line and This turn sit in the tree with the receipts derived from the same doc', () => {
    mount();
    expect(container.textContent).toContain('Checked 12:47 PM · next ~1:02 PM');
    expect(container.querySelector('[data-this-turn="filed"]').textContent).toContain('Filed 11:31 AM');
    expect(container.textContent).not.toContain('11:33');
  });
});

describe('the tape (A2.2, D-72) — one stream, built in the screen, rendered in the chat', () => {
  it('the chat carries a trade card and a check card beside the messages', () => {
    mount();
    const cards = [...container.querySelectorAll('[data-tape-kind]')];
    expect(cards.length).toBeGreaterThanOrEqual(2);

    const trade = container.querySelector('[data-tape-kind="trade"]');
    expect(trade).toBeTruthy();
    // The pair, the time and the motive — from trades[], not the feed.
    expect(trade.textContent).toContain('11:02 AM · MU → SLB');
    expect(trade.textContent).toContain('MU rolled over; SLB leads energy.');
    // No `source` on this record, so the motive is the system's by default —
    // under-crediting the agent is the safe direction under C1.
    expect(trade.textContent).toContain('The system\'s reason');
    // The machinery code never reaches the screen (hazard 29, D-64).
    expect(trade.textContent).not.toContain('haiku_decision');

    const check = container.querySelector('[data-tape-kind="check"]');
    expect(check).toBeTruthy();
    // The SAME label the Why? panel gives this tick (BUILD_RULES §9).
    expect(check.textContent).toContain('At the 12:47 PM check · Argued for a swap · held by a guardrail');
    expect(check.textContent).toContain('SLB lost its bid; swap SLB for DVN.');
  });

  it('ONE SORT — the cards sit in time order among the messages, oldest first', () => {
    mount();
    // The tape's own entries, in DOM order: the 11:02 trade precedes the
    // 12:47 check. A second array with its own sort could not guarantee this.
    const kinds = [...container.querySelectorAll('[data-tape-kind]')].map((el) => el.getAttribute('data-tape-kind'));
    expect(kinds.indexOf('trade')).toBeLessThan(kinds.indexOf('check'));
  });

  it('the shipped slim trade line is REPLACED by the card under the flag, not shown beside it', () => {
    mount();
    // TradeTickerCard renders the pair as its own markup; under the flag the
    // tape's card is the only trade rendering in the stream.
    expect(container.querySelectorAll('[data-tape-kind="trade"]')).toHaveLength(1);
    const pairMentions = container.innerHTML.split('MU → SLB').length - 1;
    expect(pairMentions).toBe(1);
  });
});
