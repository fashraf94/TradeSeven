// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.flagOff.tape.jsdom.test.jsx
//
// A2.2 — THE SEAM THE GOLDENS CANNOT SEE (A2 review L3-F2).
//
// The two flag-off goldens pin the flag-off render, and between them they miss
// exactly this: `agentBattleScreen.tabbed.html` is captured on the `matchups`
// tab, which contains no chat at all, and `agentChat.tabbed.html` renders
// `<AgentChat>` DIRECTLY with a fixed prop set — bypassing the screen. So the
// screen → chat wiring is unphotographed, and a reviewer proved the point:
// removing BOTH flag gates on `tapeEntries` leaked the whole A2 tape into the
// shipped Command Center tab with all 3506 tests green.
//
// This file mounts the REAL screen with the controller OFF, opens the tab that
// holds the chat, and asserts the shipped rendering: the slim trade line, and
// not one tape card. It is the composition test the goldens cannot be.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
// A signed-in user, so the failed-send row below reaches the FETCH branch
// rather than the `Session expired` early return. Nothing else in this file
// reads auth.
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: { getIdToken: async () => 'token' } })) }));
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
  // THE CONTROLLER OFF — the whole point of this file.
  isBattleViewControllerOn: () => false,
  // Mocked EXPLICITLY, not left to the flag's default (review lens 3 F2, and
  // the smoke branch that found the three files it missed).
  // isCharacterPaneOn() calls isBattleViewControllerOn() INSIDE featureFlags,
  // so a vi.mock of the controller never reaches it — on the day the pane flag
  // flips, this suite would see the pane on with the controller state it asked
  // for, which is not the state it means to test.
  isCharacterPaneOn: () => false,
}));
vi.mock('../services/eodhdAPI', () => ({
  stockAPI: {
    getMultipleStockPrices: vi.fn(async () => ({})),
    getMultipleCryptoPrices: vi.fn(async () => ({})),
  },
  POPULAR_CRYPTO: [],
}));
vi.mock('../components/Agent/LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

// A document rich enough that a leak would be LOUD: an executed swap (a trade
// card under the flag, a slim line flag-off) and four quiet checks (four check
// cards and a collapsed run under the flag, nothing at all flag-off).
const quiet = (hhmm) => ({
  evalId: `e_${hhmm}`, timestamp: `2026-09-01T${hhmm}:00.000Z`, decision: 'HOLD', downgraded: false,
  rationale: 'The book is holding its shape. Nothing in the tape argues for a rotation yet.',
  scores: { active: 1, banked: 40, total: 41 },
});
const LIVE_DOC = {
  id: 'ab-1',
  status: 'active',
  activatedAt: '2026-09-01T13:30:00.000Z',
  agentContext: {
    agentName: 'Aurora',
    strategyBrief: 'Energy is the only sector with a bid this week.',
    innerMonologue: { strategy: 'Lean energy.', starRationale: 'SLB is the cleanest energy breakout.' },
    equippedWatchlist: { watchlistId: 'w1', tickers: ['XOM'] },
  },
  scoreState: { currentScore: 12, opponentScore: 3, tradeCount: 1, evaluationCount: 5, lastScoredAt: '2026-09-01T16:47:00.000Z' },
  portfolio: {
    star: [{ symbol: 'AAPL' }, { symbol: 'SLB', swapPrice: 34.1, swappedInAt: '2026-09-01T15:02:00.000Z' }],
    core: [{ symbol: 'NVDA' }],
    support: [],
    bench: { stocks: [{ symbol: 'DVN' }], crypto: null },
    startingPrices: { AAPL: 150, NVDA: 900, MU: 90 },
  },
  opponent: { portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [] } },
  evaluations: [quiet('14:00'), quiet('14:15'), quiet('14:30'), quiet('14:45')],
  // A2.3 (review L3-F1 / L4-F1): three bench lists, none of them in the book.
  // Under the flag the detector's roster is the union of all four; flag-off it
  // is the book alone, and the rows below are what says so. The golden cannot:
  // it is captured on the matchups tab, and the chat golden renders AgentChat
  // directly with a hardcoded `knownTickers`.
  watchlist: { active: [], hotBench: ['GILD'], monitoring: [] },
  trades: [
    { symbolOut: 'MU', symbolIn: 'SLB', tier: 'star', lockedPoints: 8, swappedOutAt: '2026-09-01T15:02:00.000Z', evaluationId: 'eval_005', source: 'haiku', rationale: 'MU rolled over; SLB leads energy.' },
  ],
  statusFeed: [
    { timestamp: '2026-09-01T15:02:00.000Z', action: 'swap', evalId: 'eval_005', symbolOut: 'MU', symbolIn: 'SLB', message: 'Rotated the star slot.' },
  ],
  chatExchanges: [
    { userMessage: 'protect the lead', agentResponse: 'Got it.', timestamp: '2026-09-01T15:31:00.000Z' },
    // Names SLB (in the book) and DVN / GILD / XOM (bench only) — so the
    // roster's width is readable straight off the rendered entity spans.
    { userMessage: 'what about DVN, GILD and XOM?', agentResponse: 'NVDA leads; DVN, GILD and XOM are bench.', timestamp: '2026-09-01T15:41:00.000Z' },
    {
      userMessage: 'lock it in', agentResponse: 'Filed.', hasDirective: true,
      directive: { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1' },
      directiveThreadId: 't-1', timestamp: '2026-09-01T15:51:00.000Z',
    },
  ],
  directive: { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1', createdAt: '2026-09-01T15:51:00.000Z' },
};
vi.mock('../hooks/useAgentBattle', () => ({
  default: () => ({
    battle: LIVE_DOC, statusFeed: LIVE_DOC.statusFeed, executionMode: 'copilot', pendingProposal: null,
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

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
// The tab content is inside an AnimatePresence, so the outgoing tab must finish
// exiting before the incoming one mounts (the sibling controller suite's
// precedent). Timers and rAF are real here; only the clock is pinned.
const settle = (ms = 800) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

const openTheChat = async () => {
  act(() => {
    root.render(<AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />);
  });
  // The shipped screen keeps the chat behind the Command Center tab.
  const tab = [...container.querySelectorAll('button')]
    .find((b) => /command/i.test(b.textContent || ''));
  expect(tab, 'the shipped Command Center tab should exist flag-off').toBeTruthy();
  click(tab);
  await settle();
};

describe('flag-off, through the SCREEN: the tape never reaches the shipped chat (review L3-F2)', () => {
  it('MUTATION ROW — not one tape card renders, on a document that would produce six', async () => {
    await openTheChat();
    // Under the flag this document yields one trade card, four check cards and
    // a collapsed run. Flag-off it must yield none of them.
    expect(container.querySelectorAll('[data-tape-kind]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-tape-kind="trade"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-tape-kind="check"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-tape-kind="checkRun"]')).toHaveLength(0);
  });

  it('MUTATION ROW — none of the tape\'s own copy reaches the shipped page either', async () => {
    await openTheChat();
    const text = container.textContent;
    for (const shouldNotAppear of [
      'checks · no change',
      'The agent\'s own words',
      'The system\'s reason',
      'Banked 8.0 pts',
      'Read more',
      'At the 12:47 PM check',
      'The plan at deploy',
      'At deploy ·',
      'from the scoring path',
      'Read the full check',
      'Woken by',
      // Flip-prep item 2's kind eyebrows (review L3-F4). This list caught them
      // before only because the CARDS leaked at the same time — the eyebrows
      // ride the same `tapeEntries` prop but render on the MESSAGE bubbles,
      // which the shipped page has plenty of, so a gate that leaked only the
      // eyebrow would have gone unseen.
      'Status check ·',
      'Bench note',
      'Trade note',
      'Opener',
    ]) {
      expect(text, `flag-off page must not contain "${shouldNotAppear}"`).not.toContain(shouldNotAppear);
    }
    // …and not by attribute either. `[data-tape-kind]` does NOT match
    // `data-tape-kind-eyebrow` — different attribute, so the existing card
    // sweep never covered these.
    expect(container.querySelector('[data-tape-kind-eyebrow]')).toBeNull();
  });

  it('THE SHIPPED UNREAD DOT STILL CLEARS — the flag-off path is behaviour, not source text (review L3-F1)', async () => {
    // Item 4 moved the controller's read from `:976` to `:1322` while the
    // flag-off render-time write stayed at `:602`: the gap between them grew
    // from 389 lines to 720. The only guard was a SOURCE row asserting the
    // write's bytes and its position-independent presence — so moving that
    // write to AFTER the read it feeds left the whole suite green while the
    // shipped Command Center dot never cleared again.
    //
    // This is the behavioural half. It is deliberately about the SHIPPED tab
    // bar, which is the surface the controller flag removes.
    //
    // The dot carries no test attribute and must not grow one — the flag-off
    // golden is a byte comparison, so an attribute added for a test's
    // convenience would break the very guarantee this file exists to hold. It
    // is found structurally instead: the absolutely-positioned 7px circle
    // inside the Command Center tab button.
    act(() => {
      root.render(<AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />);
    });
    await settle();
    const commandTab = () => [...container.querySelectorAll('button')]
      .find((b) => /command/i.test(b.textContent || ''));
    const dot = () => commandTab()?.querySelector('span[style*="border-radius:50%"], span[style*="border-radius: 50%"]') ?? null;

    expect(commandTab()).toBeTruthy();
    // A feed entry the player has not seen yet lights the shipped dot.
    expect(dot()).toBeTruthy();

    // Opening the Command Center marks it seen — the render-time clear.
    click(commandTab());
    await settle();
    expect(dot()).toBeNull();
  });

  it('A2.3 (review L3-F1 / L4-F1) — the DETECTOR\'s roster is the BOOK, never the bench lists', async () => {
    // The gate on `knownTickers` was the one load-bearing flag gate on a
    // SHIPPED surface that no test could see: removing it left all 3701 tests
    // green while widening what the shipped chat underlines — and an underline
    // is a tappable span that opens AssetResearchModal.
    await openTheChat();
    const named = [...container.querySelectorAll('[aria-label^="Open research for"]')]
      .map((el) => el.getAttribute('aria-label'));
    // The book underlines…
    expect(named).toContain('Open research for NVDA');
    // …the three bench lists do NOT.
    expect(named).not.toContain('Open research for DVN');   // portfolio.bench.stocks
    expect(named).not.toContain('Open research for GILD');  // watchlist.hotBench
    expect(named).not.toContain('Open research for XOM');   // equippedWatchlist.tickers
  });

  it('A2.3 (review L3-F4) — the shipped mount gets no controller COPY and no RECEIPTS', async () => {
    // Two more gates the component-level tests cannot see, because they guard
    // the SCREEN's wiring rather than the component's prop contract.
    await openTheChat();
    // The receipts gate: the shipped eyebrow, never `Directive` + a receipt.
    expect(container.textContent).toContain('DIRECTIVE LOCKED IN');
    expect(container.querySelector('[data-receipt]')).toBeNull();
    expect(container.textContent).toContain('Executing on next evaluation window');
  });

  it('A2.3 (review L3-F4) — a FAILED SEND on the shipped page keeps the shipped words', async () => {
    // The copy gate cannot be seen by looking at a page nobody has sent from:
    // item 11's line only exists on a failed send, so the row has to make one.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await openTheChat();
    const ta = container.querySelector('textarea');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, 'sell it');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // Enter in the composer, not a button lookup: this page has a dozen
    // buttons with an svg in them and the chat's send control is not the first.
    await act(async () => {
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Agent is thinking too hard. Try again.');
    expect(container.textContent).not.toContain('The character couldn\u2019t answer just now');
    expect(container.textContent).not.toContain("The character couldn't answer just now");
    vi.unstubAllGlobals();
  });

  // NOT A ROW HERE, DELIBERATELY (review L3-F3): "the A2.3 scroll effect never
  // runs flag-off" cannot be made to fail flag-off. Its only dependency is
  // `scopeSymbol`, which is permanently null on the shipped path, so the
  // effect fires once on mount and never again whatever its gates say — and
  // that one write puts 0 into a list already at 0. A row asserting it would
  // be a row that cannot fail, which is worse than no row. The falsifiable
  // half of the claim — that a re-render with an unchanged scope writes
  // nothing — lives where it CAN fail, on the flag path, in
  // AgentChat.scope.jsdom.test.jsx.

  it('and the SHIPPED chat is really on screen — this asserts a rendered chat, not a blank page', async () => {
    // Without this row the two above would pass on a blank page, which is the
    // failure mode that let the leak through in the first place.
    await openTheChat();
    // Without this row the two above would pass on a page with no chat at all,
    // which is the failure mode that let the leak through in the first place:
    // the screen golden is captured on the `matchups` tab and never sees one.
    expect(container.querySelector('textarea'), 'the shipped composer').toBeTruthy();
    expect(container.textContent).toContain('protect the lead');
    expect(container.textContent).toContain('MU');
  });
});
