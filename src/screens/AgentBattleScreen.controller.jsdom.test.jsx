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
// The doc the hook hands back, overridable per test: the SCREEN's own gating —
// selectDeployPlan, selectDeployPlanForSymbol, the tape's receipts input, the
// Why? door's handler, the short guard — ships at this call site, and a review
// pass (L4-F1, F4, F5, F6, F7) showed every one of them could be removed with
// the whole suite green because nothing mounted the screen against a document
// that would notice.
let DOC = LIVE_DOC;
const withDoc = (over) => { DOC = { ...LIVE_DOC, ...over }; };
vi.mock('../hooks/useAgentBattle', () => ({
  default: () => ({
    battle: DOC, statusFeed: [], executionMode: 'copilot', pendingProposal: null,
    strategyPreset: 'balanced', gameplanMeeting: null, chatExchanges: DOC.chatExchanges,
    feedBookmarks: [], loading: false,
  }),
}));

import AgentBattleScreen from './AgentBattleScreen';
import { checkEntryId } from './battleView/buildTape';

const BATTLE = {
  agentId: 'agent-1', agentBattleId: 'ab-1',
  creator: { portfolio: { star: [{ symbol: 'AAPL' }, { symbol: 'MU' }], core: [{ symbol: 'NVDA' }], support: [] } },
  opponent: { portfolio: { star: [{ symbol: 'MSFT' }], core: [], support: [] } },
  state: { startingPrices: { AAPL: 150, NVDA: 900, MU: 90 } },
};

// The two sides of the board, for D-85's row below: the player's pieces come
// off the subscribed doc's own portfolio, the CPU's off `opponent`.
const PLAYER_SYMBOLS = ['AAPL', 'SLB', 'NVDA'];
const OPPONENT_SYMBOLS = ['AMD'];

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
  DOC = LIVE_DOC;
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
    expect(panel.textContent).toContain('From the 12:45 PM check');
    expect(panel.textContent).not.toContain('At the 12:45 PM check');
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

  it('the score header opens the book panel COLLAPSED, and the close returns focus to it (D-89)', async () => {
    mount();
    const header = [...container.querySelectorAll('[role="button"][aria-expanded]')].find((el) => el.textContent.includes('Aurora') && el.textContent.includes('CPU'));
    expect(header).toBeTruthy();
    expect(header.getAttribute('aria-expanded')).toBe('false');
    click(header);

    const book = container.querySelector('[data-why-symbol="book"]');
    expect(book).toBeTruthy();
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(book.textContent).toContain('At the 12:45 PM check');
    expect(book.querySelector('[data-this-turn]')).toBeNull();
    expect(container.querySelectorAll('[data-this-turn]').length).toBe(1);
    expect(book.textContent).not.toContain('Entry $');
    // COLLAPSED (D-89): the door rides the expansion, so a glance at the
    // latest check is not also a decision to speak.
    expect(book.querySelector('[data-why-book-body="collapsed"]')).toBeTruthy();
    expect(book.textContent).not.toContain('Ask a follow-up · 1 message');

    // THE CLOSE. A disclosure that unmounts the region it owns and leaves
    // focus on it drops a keyboard reader to `document.body`; the score header
    // carries this panel's `aria-expanded`, so focus goes back there.
    const close = book.querySelector('[data-why-book-close]');
    expect(close).toBeTruthy();
    expect(close.getAttribute('aria-label')).toBe('Close the check');
    click(close);
    // Focus moves in the same tick as the state — a reader must not be left on
    // a region that is on its way out.
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(header);
    // …and the panel leaves once its exit animation has run (AnimatePresence).
    await settle(400);
    expect(container.querySelector('[data-why-symbol="book"]')).toBeNull();
  });

  it('the book panel EXPANDS into a bounded, scrollable region (D-89)', () => {
    // The bound is what makes the tap safe: an unbounded expansion above the
    // board pushes the board off the screen — the defect the ruling exists to
    // close, and a long check is the ordinary case, not the edge one. jsdom
    // does no layout, so what this row can hold is the style contract.
    withDoc({
      evaluations: [{
        ...LIVE_DOC.evaluations[0],
        rationale: 'The book is holding its shape. Nothing in the tape argues for a rotation yet.',
      }],
    });
    mount();
    const header = [...container.querySelectorAll('[role="button"][aria-expanded]')].find((el) => el.textContent.includes('Aurora') && el.textContent.includes('CPU'));
    click(header);

    const collapsed = container.querySelector('[data-why-book-body="collapsed"]');
    expect(collapsed).toBeTruthy();
    expect(collapsed.textContent).toContain('The book is holding its shape.');
    expect(collapsed.textContent).not.toContain('Nothing in the tape argues');

    click(container.querySelector('[data-why-book-more]'));
    const expanded = container.querySelector('[data-why-book-body="expanded"]');
    expect(expanded).toBeTruthy();
    expect(expanded.textContent).toContain('Nothing in the tape argues for a rotation yet.');
    expect(expanded.style.maxHeight).toBe('40vh');
    expect(expanded.style.overflowY).toBe('auto');
    expect(expanded.style.overscrollBehavior).toBe('contain');
    // …and the door arrives with it.
    expect(container.querySelector('[data-why-symbol="book"]').textContent)
      .toContain('Ask a follow-up · 1 message');
  });

  it('the deploy brief rides the expansion AND SITS INSIDE THE BOUND (D-76, review L1-F3)', () => {
    // Two claims the previous row only appeared to make. Its fixture had no
    // `strategyBrief` at all, so "the deploy brief arrives with it" asserted
    // nothing — deleting the whole book-brief block left the entire suite
    // green. And the brief rendered as the bounded region's SIBLING, while
    // `strategyBrief` is never truncated: one tap added 40vh of bounded
    // rationale PLUS an unbounded brief above the board, which is the exact
    // defect D-89 exists to close.
    const brief = 'Energy is the only sector with a bid this week. '.repeat(12).trim();
    withDoc({
      agentContext: { ...LIVE_DOC.agentContext, strategyBrief: brief },
      evaluations: [{
        ...LIVE_DOC.evaluations[0],
        rationale: 'The book is holding its shape. Nothing in the tape argues for a rotation yet.',
      }],
    });
    mount();
    const header = [...container.querySelectorAll('[role="button"][aria-expanded]')].find((el) => el.textContent.includes('Aurora') && el.textContent.includes('CPU'));
    click(header);

    // Collapsed: history is not what a glance at the latest check is for.
    expect(container.querySelector('[data-why-book-plan]')).toBeNull();

    click(container.querySelector('[data-why-book-more]'));
    const plan = container.querySelector('[data-why-book-plan]');
    expect(plan).toBeTruthy();
    expect(plan.textContent).toContain('The plan at deploy');
    expect(plan.textContent).toContain('Energy is the only sector with a bid this week.');
    // THE BOUND CONTAINS IT — this is the half that could not fail before.
    const bounded = container.querySelector('[data-why-book-body="expanded"]');
    expect(bounded.contains(plan)).toBe(true);
  });

  it('the turn line and This turn sit in the tree with the receipts derived from the same doc', () => {
    mount();
    expect(container.textContent).toContain('Checked 12:45 PM · next ~1:00 PM');
    expect(container.querySelector('[data-this-turn="filed"]').textContent).toContain('Filed 11:31 AM');
    expect(container.textContent).not.toContain('11:33');
  });

  it('D-85 — the PLAYER\'s rows carry their current price; no CPU row does', () => {
    // The screen's own wiring, which the row's unit test cannot see: the flag
    // decides, and the prop reaches the left AssetSide only.
    mount();
    const prices = [...container.querySelectorAll('[data-row-price]')]
      .map((el) => el.getAttribute('data-row-price'));
    expect(prices.length).toBeGreaterThan(0);
    // Every symbol carrying a price is one of the player's pieces.
    for (const symbol of prices) expect(PLAYER_SYMBOLS).toContain(symbol);
    for (const symbol of OPPONENT_SYMBOLS) expect(prices).not.toContain(symbol);
  });
});

describe('`Read the full check` opens the check\'s own CARD (D-89)', () => {
  const scrolls = [];
  // Restored in afterEach: this file's other describes rely on the harness's
  // own no-op stub, and a spy left on the prototype would outlive this block.
  const realScrollIntoView = Element.prototype.scrollIntoView;
  beforeEach(() => {
    scrolls.length = 0;
    Element.prototype.scrollIntoView = function scrollIntoView(opts) { scrolls.push([this, opts]); };
  });
  afterEach(() => { Element.prototype.scrollIntoView = realScrollIntoView; });

  const doorFor = (symbol) => {
    click(rowButtonFor(symbol));
    const door = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Read the full check');
    expect(door).toBeTruthy();
    return door;
  };

  it('opens the conversation at the CARD — scrolled to it, expanded, focused — not the panel', async () => {
    // Ruling 4 sent this door to the book panel above the board. Two things
    // were wrong and only a ruling could fix them: the panel is the LATEST
    // check for the whole book, not necessarily the check the row's extract
    // came from; and it opens above the board, so a reader on a low row was
    // thrown to the top of the page with no way back to where they were.
    mount();
    const door = doorFor('SLB');
    expect(container.querySelector('[data-why-symbol="book"]')).toBeNull();

    click(door);
    await settle(100);

    // The panel above the board is NOT what opened.
    expect(container.querySelector('[data-why-symbol="book"]')).toBeNull();

    // The card is. Its id is the builder's own — `checkEntryId` — so the
    // screen cannot ask for an address the tape does not stamp.
    const card = container.querySelector(`[data-tape-entry-id="${checkEntryId(LIVE_DOC.evaluations[0])}"]`);
    expect(card).toBeTruthy();
    expect(card.getAttribute('data-tape-kind')).toBe('check');
    expect(scrolls.some(([el]) => el === card)).toBe(true);
    expect(document.activeElement).toBe(card);
    // EXPANDED: the whole check, which is what the door's words promise. This
    // fixture's rationale is one sentence, so what proves the expansion is the
    // absence of the door out of a collapsed record.
    expect(card.textContent).toContain('SLB lost its bid; swap SLB for DVN.');
    expect(card.textContent).not.toContain('Read more');
  });

  it('UNFOLDS the card and OPENS it — a quiet check is the ordinary target of this door', async () => {
    // The two claims a one-evaluation, one-sentence fixture cannot make, and
    // both mutations survived without this row:
    //
    //   · a HOLD with words is `quiet` by D-77's four conjuncts, so the
    //     ordinary target of `Read the full check` is the ordinary member of a
    //     RUN — and a folded run has no card to scroll to;
    //   · `startExpanded` is invisible unless the rationale has a second
    //     sentence to be hiding.
    //
    // Three adjacent quiet checks with the SAME run key, so they fold; the
    // newest is the one the door names.
    const quiet = (id, hhmm, rationale) => ({
      evalId: id,
      timestamp: `2026-09-01T${hhmm}:02.000Z`,
      decision: 'HOLD',
      downgraded: false,
      rationale,
      haikuError: null,
      scores: { banked: 40 },
      triggers: ['threshold_proximity'],
    });
    withDoc({
      evaluations: [
        quiet('q1', '16:15', 'SLB is quiet.'),
        quiet('q2', '16:30', 'SLB is still quiet.'),
        quiet('q3', '16:47', 'SLB holds its bid into the close. Nothing in the tape argues for a rotation yet.'),
      ],
    });
    mount();

    // Unasked, all three are ONE line — the fold D-77 exists for.
    expect(container.querySelector('[data-tape-kind="checkRun"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-tape-kind="check"]').length).toBe(0);

    click(doorFor('SLB'));
    await settle(100);

    // The named card is out of the fold…
    const card = container.querySelector(`[data-tape-entry-id="${checkEntryId({ evalId: 'q3', timestamp: '2026-09-01T16:47:02.000Z' })}"]`);
    expect(card).toBeTruthy();
    // …the other two are still folded, so the run still stands for a
    // contiguous slice rather than being torn open around it.
    expect(container.querySelector('[data-tape-kind="checkRun"]')).toBeTruthy();
    // …and it is OPEN: the second sentence is on screen and the door out of a
    // collapsed record is not.
    expect(card.textContent).toContain('Nothing in the tape argues for a rotation yet.');
    expect(card.textContent).not.toContain('Read more');
    expect(document.activeElement).toBe(card);
  });

  it('THE CARD REALLY EXPANDS when it was already on screen (review L2-F2 / L5-F2)', async () => {
    // `startExpanded` was read once as a `useState` seed, so it was a NO-OP
    // whenever the card was already mounted — which is the ordinary case on
    // both shells. The door said `Read the full check` and delivered the first
    // sentence with a `Read more` under it. The three committed rows that
    // asserted the expansion all used ONE-sentence rationales, so
    // `not.toContain('Read more')` was true either way; only the folded-run
    // path — the one case where the card genuinely mounts on the pinning
    // commit — ever exercised it.
    //
    // A downgraded HOLD is never `quiet`, so it is never folded: it is on
    // screen from the first paint, and its two sentences make the claim fail
    // when the code stops making it true.
    withDoc({
      evaluations: [{
        evalId: 'eval_open', timestamp: '2026-09-01T16:47:02.000Z',
        decision: 'HOLD', downgraded: true, haikuError: null,
        rationale: 'SLB lost its bid. DVN is showing the stronger tape and takes the slot.',
      }],
    });
    mount();

    const before = container.querySelector('[data-tape-kind="check"]');
    expect(before).toBeTruthy();                       // already mounted…
    expect(before.textContent).toContain('Read more'); // …and collapsed
    expect(before.textContent).not.toContain('DVN is showing the stronger tape');

    click(doorFor('SLB'));
    await settle(100);

    const after = container.querySelector('[data-tape-kind="check"]');
    expect(after.textContent).toContain('DVN is showing the stronger tape and takes the slot.');
    expect(after.textContent).not.toContain('Read more');
    expect(document.activeElement).toBe(after);
  });

  it('THE SCOPE COMES OFF — the door is never a silent no-op (review L2-F3 / L5-F3)', async () => {
    // `scopeTape` runs BEFORE the pin and judges a check by whether its first
    // sentence names the piece, while this door's gate asks whether the check
    // has words at all. So a scoped stream routinely did not contain the check
    // the door pointed at, and the door did nothing whatsoever — while on the
    // phone the sheet still swallowed the screen to show a filtered tape with
    // no target in it. Both doors are in the same panel, one under the other.
    withDoc({
      evaluations: [{
        ...LIVE_DOC.evaluations[0],
        rationale: 'The book is holding its shape. SLB is the one that worries me.',
      }],
    });
    mount();
    click(rowButtonFor('SLB'));
    click(container.querySelector('[data-why-scope="SLB"]'));
    await settle(100);
    expect(container.querySelector('[data-tape-scope="SLB"]')).toBeTruthy();

    // …now the OTHER door in the same panel.
    const door = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Read the full check');
    expect(door).toBeTruthy();
    click(door);
    await settle(100);

    expect(container.querySelector('[data-tape-scope]')).toBeNull();
    const card = container.querySelector(`[data-tape-entry-id="${checkEntryId(LIVE_DOC.evaluations[0])}"]`);
    expect(card).toBeTruthy();
    expect(document.activeElement).toBe(card);
  });

  it('the conversation is OPEN — a card far up a long tape needs the room', async () => {
    // ONE call for both shells: since ruling 7 the detent is one thing, and
    // FULL is an open detent on the desktop too, which renders the column.
    // This file's matchMedia stub reads as desktop, so the column is what the
    // door has to have opened; the mobile half (`data-chat-sheet="full"`) is
    // held in the layout file, which mounts both widths.
    mount();
    click(doorFor('SLB'));
    await settle(100);
    const column = container.querySelector('[data-chat-column]');
    expect(column).toBeTruthy();
    expect(column.getAttribute('data-chat-collapsed')).toBe('false');
    expect(container.querySelector('[data-peek-strip]')).toBeNull();
  });

  it('the scroll is `nearest`, and the card is reachable but not in the tab order', async () => {
    mount();
    click(doorFor('SLB'));
    await settle(100);
    const card = container.querySelector('[data-tape-kind="check"]');
    const [, opts] = scrolls.find(([el]) => el === card);
    expect(opts.block).toBe('nearest');
    // `tabIndex={-1}`: a reader arrives here by asking to, never by tabbing
    // past thirty cards.
    expect(card.getAttribute('tabindex')).toBe('-1');
  });

  it('ASKING TWICE scrolls twice — the nonce, not the id, is what re-fires it', async () => {
    mount();
    const door = doorFor('SLB');
    click(door);
    await settle(100);
    const card = container.querySelector('[data-tape-kind="check"]');
    act(() => { door.focus(); });
    expect(document.activeElement).toBe(door);
    scrolls.length = 0;

    click(door);
    await settle(100);
    expect(scrolls.some(([el]) => el === card)).toBe(true);
    expect(document.activeElement).toBe(card);
  });
});

describe('the piece scope (A2.3, D-73) — the door, the chip, and the way back', () => {
  it('the door counts what the tap opens, and the tap filters the tape to the piece', async () => {
    mount();
    click(rowButtonFor('SLB'));
    const panel = container.querySelector('[data-why-symbol="SLB"]');
    const door = panel.querySelector('[data-why-scope="SLB"]');
    expect(door).toBeTruthy();

    // THE PROPERTY: the number on the door is the length of the list it opens.
    const n = Number(door.textContent.replace(/\D+/g, ''));
    expect(door.textContent).toBe(`In the chat · ${n}`);
    expect(n).toBeGreaterThan(0);

    click(door);
    await settle(100);
    // The chip says what the stream is filtered to and how to leave.
    const chip = container.querySelector('[data-tape-scope="SLB"]');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toBe('SLB · All');

    // …and the stream really is FILTERED (review L4-F9: the old row summed two
    // lengths and asserted `>= 0`, which no defect could fail). In this
    // fixture n = 2: the `MU → SLB` trade and the check whose first sentence
    // names SLB. The directive exchange, which names no piece, is gone from
    // the chat — asserted INSIDE the chat column, because `This turn` renders
    // the same directive text above the board.
    const column = chip.closest('[data-chat-column]');
    expect(column).toBeTruthy();
    expect(column.querySelectorAll('[data-tape-kind]').length).toBe(n);
    expect(column.textContent).toContain('MU → SLB');
    expect(column.textContent).toContain('Status check · 12:45 PM');
    expect(column.textContent).not.toContain('Protect the lead into the close');
    expect(column.querySelector('[data-receipt]')).toBeNull();
  });

  it('a piece nothing has been said about still gets a door, and it opens the WHOLE tape', async () => {
    // Seed §A2.3, verbatim: "Zero → the door still renders as `In the chat ·
    // 0`, opens the unscoped tape at the piece's composer prefill."
    mount();
    click(rowButtonFor('AAPL'));
    const door = container.querySelector('[data-why-scope="AAPL"]');
    expect(door).toBeTruthy();
    expect(door.textContent).toBe('In the chat · 0');
    click(door);
    await settle(100);
    // NO chip, and the whole tape is still there — never the filtered-to-
    // nothing stream, which fell through to the fresh-battle EmptyState.
    expect(container.querySelector('[data-tape-scope]')).toBeNull();
    expect(container.querySelector('[data-tape-kind]')).toBeTruthy();
    expect(container.textContent).not.toContain('Your agent is ready');
    // The composer is prefilled with the piece — the door reads the
    // conversation, the prefill is how the player joins it.
    expect(container.querySelector('textarea').value).toBe('About AAPL — ');
  });

  it('the scope CLEARS ITSELF when its piece leaves the battle (review L2-F7)', async () => {
    // The agent swaps SLB out, or the doc changes under the player: a chip
    // naming a piece the battle no longer has filters a stream nobody can get
    // back to except by tapping it. The fix had no row and survived being
    // deleted with the whole suite green (refuter A M59).
    mount();
    click(rowButtonFor('SLB'));
    click(container.querySelector('[data-why-scope="SLB"]'));
    await settle(100);
    expect(container.querySelector('[data-tape-scope="SLB"]')).toBeTruthy();

    // SLB leaves the book — the roster is built from the portfolio the rows
    // render, so removing it there is what a swap does to this screen.
    withDoc({
      portfolio: {
        ...LIVE_DOC.portfolio,
        star: [{ symbol: 'AAPL' }, { symbol: 'DVN', swapPrice: 34.1, swappedInAt: '2026-09-01T15:02:00.000Z' }],
      },
    });
    mount();
    await settle(100);
    expect(container.querySelector('[data-tape-scope="SLB"]')).toBeNull();
    expect(container.querySelector('[data-tape-scope]')).toBeNull();
    // …and the whole tape is back, not a stream filtered to nothing.
    expect(container.querySelector('[data-tape-kind]')).toBeTruthy();
    expect(container.textContent).not.toContain('Your agent is ready');
  });

  it('BOTH ENDS ARE NAMED AND THE CHANGE IS SPOKEN (review RB-F10)', async () => {
    // Neither visible label says what its button DOES: `In the chat · 2` reads
    // as a count, `SLB · All` as a label, and a screen reader announced a
    // number and a word where a filter was about to be applied or cleared.
    // And the door deliberately moves focus to the COMPOSER — past the stream
    // it just changed — so the change itself needs saying out loud.
    mount();
    click(rowButtonFor('SLB'));
    const door = container.querySelector('[data-why-scope="SLB"]');
    const n = Number(door.textContent.replace(/\D+/g, ''));
    expect(door.getAttribute('aria-label')).toBe(`Show the SLB messages · ${n} in the chat`);

    // Nothing is announced for ARRIVING at the page: the region is present and
    // empty, which is what keeps its first real change audible.
    const region = container.querySelector('[data-scope-announce]');
    expect(region).toBeTruthy();
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('');

    click(door);
    await settle(100);
    const chip = container.querySelector('[data-tape-scope="SLB"]');
    expect(chip.getAttribute('aria-label')).toBe('Showing SLB only · show the whole tape');
    // The count it speaks is the SCOPED stream's own length, not the door's
    // promise — one derivation, so the two cannot disagree (BUILD_RULES §9).
    const shown = chip.closest('[data-chat-column]').querySelectorAll('[data-tape-kind]').length;
    expect(region.textContent).toBe(`Showing ${shown} SLB ${shown === 1 ? 'entry' : 'entries'}`);

    // …and clearing says so too.
    click(chip);
    await settle(100);
    expect(container.querySelector('[data-scope-announce]').textContent)
      .toBe('Showing the whole tape');
  });

  it('the scope region does NOT re-speak on an ordinary snapshot (review RB-F10)', async () => {
    // A live region keyed on the stream's length would speak on every
    // Firestore snapshot — a message, a feed entry, a tick — which is worse
    // than silence. The scope's TRANSITION is the whole trigger.
    mount();
    click(rowButtonFor('SLB'));
    click(container.querySelector('[data-why-scope="SLB"]'));
    await settle(100);
    const spoken = container.querySelector('[data-scope-announce]').textContent;
    expect(spoken).toContain('SLB');

    // A new exchange lands with the scope unchanged: the doc the hook hands
    // back is a fresh object, exactly as a Firestore snapshot makes it, and
    // the stream grows by one.
    withDoc({
      chatExchanges: [
        ...LIVE_DOC.chatExchanges,
        { userMessage: 'and now?', agentResponse: 'SLB still leads.', timestamp: '2026-09-01T16:50:00.000Z' },
      ],
    });
    mount();
    await settle(100);
    expect(container.querySelector('[data-scope-announce]').textContent).toBe(spoken);
  });

  it('the chip clears the scope and the whole tape comes back', async () => {
    mount();
    click(rowButtonFor('SLB'));
    click(container.querySelector('[data-why-scope="SLB"]'));
    await settle(100);
    const before = container.querySelectorAll('[data-tape-kind]').length;
    click(container.querySelector('[data-tape-scope="SLB"]'));
    await settle(100);
    expect(container.querySelector('[data-tape-scope="SLB"]')).toBeNull();
    expect(container.querySelectorAll('[data-tape-kind]').length).toBeGreaterThanOrEqual(before);
    // The trade card that is not about SLB is back.
    expect(container.textContent).toContain('Status check · 12:45 PM');
  });

  it('the ROSTER is the battle\'s universe under the flag — a bench name is an entity', () => {
    // `DVN` is on the deploy bench and `XOM` on the hot bench; neither is in
    // the book. Under the flag both are in the roster, so a message that names
    // one underlines it and the scope can count it. Flag-off the chat's roster
    // is the book alone and neither would be an entity at all.
    withDoc({
      portfolio: {
        ...LIVE_DOC.portfolio,
        bench: { stocks: [{ symbol: 'DVN' }], crypto: null },
      },
      watchlist: { hotBench: ['XOM'] },
      chatExchanges: [
        ...LIVE_DOC.chatExchanges,
        { userMessage: 'what about DVN and XOM?', agentResponse: 'DVN is the replacement; XOM is on the hot bench.', timestamp: '2026-09-01T16:00:00.000Z' },
      ],
    });
    mount();
    const underlined = [...container.querySelectorAll('[aria-label^="Open research for"]')]
      .map((el) => el.getAttribute('aria-label'));
    expect(underlined).toContain('Open research for DVN');
    expect(underlined).toContain('Open research for XOM');
    // …and the opponent's piece is never in the roster.
    expect(underlined).not.toContain('Open research for AMD');
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
    // The model wrote this sentence — no engine prefix — so it is the agent's
    // words, whatever the record's `source` says (review L1-F3 / L1-F4).
    expect(trade.textContent).toContain('The agent\'s own words');
    // The machinery code never reaches the screen (hazard 29, D-64).
    expect(trade.textContent).not.toContain('haiku_decision');

    const check = container.querySelector('[data-tape-kind="check"]');
    expect(check).toBeTruthy();
    // The SAME label the Why? panel gives this tick (BUILD_RULES §9).
    expect(check.textContent).toContain('Status check · 12:45 PM · Argued for a swap · held by a guardrail');
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

describe('the SCREEN\'s own gating — the call sites, not the selectors (review L4)', () => {
  const PLAN_CONTEXT = {
    agentName: 'Aurora',
    strategyBrief: 'Energy is the only sector with a bid this week; semis are extended.',
    innerMonologue: {
      strategy: 'Lean energy, fade the extended semis.',
      starRationale: 'SLB is the cleanest energy breakout on the board. AAPL is the ballast.',
      coreRationale: 'NVDA is the one semi I will hold here.',
    },
  };

  it('the plan at deploy is WIRED — a row shows its tier\'s sentences that name it, and only those', () => {
    withDoc({ gameMode: 'baggerbomb_agent', agentContext: PLAN_CONTEXT });
    mount();
    click(rowButtonFor('SLB'));
    const panel = container.querySelector('[data-why-symbol="SLB"]');
    expect(panel.textContent).toContain('At deploy · Star tier');
    expect(panel.textContent).toContain('The plan at deploy · Sep 1');
    expect(panel.textContent).toContain('SLB is the cleanest energy breakout on the board.');
    // MUTATION ROW (L4-F6): a tier rationale is never presented as a
    // position's — AAPL's sentence is in the SAME rationale and must not show.
    expect(panel.textContent).not.toContain('AAPL is the ballast');
    // …nor another tier's words, nor the brief (that is the book panel's).
    expect(panel.textContent).not.toContain('NVDA is the one semi');
    expect(panel.textContent).not.toContain('Energy is the only sector');
  });

  it('MUTATION ROW (L4-F1) — the C1 gates run HERE: a tournament battle renders no plan at all', () => {
    // The rationale NAMES SLB, so a bypassed gate would put it on the row —
    // the row must fail on the gate, not on an empty fixture.
    withDoc({ gameMode: 'baggerbomb_tournament', agentContext: {
      agentName: 'Aurora',
      strategyBrief: 'Prescribed tournament deployment',
      innerMonologue: {
        strategy: 'Prescribed tournament deployment — the drafted six.',
        starRationale: 'Prescribed tournament deployment — SLB and AAPL are the drafted pair.',
      },
    } });
    mount();
    click(rowButtonFor('SLB'));
    const panel = container.querySelector('[data-why-symbol="SLB"]');
    expect(panel.textContent).not.toContain('At deploy');
    expect(panel.textContent).not.toContain('The plan at deploy');
    expect(container.textContent).not.toContain('Prescribed tournament deployment');
  });

  it('MUTATION ROW (L4-F1) — and the algorithmic fallback template renders no plan either', () => {
    withDoc({ gameMode: 'baggerbomb_agent', agentContext: {
      agentName: 'Aurora',
      strategyBrief: 'Energy is the only sector with a bid this week.',
      innerMonologue: {
        strategy: 'Algorithmic selection based on BaggerBomb fitness scores.',
        starRationale: 'Top 2 stocks by BaggerBomb fit score for maximum upside potential. SLB leads.',
      },
    } });
    mount();
    click(rowButtonFor('SLB'));
    const panel = container.querySelector('[data-why-symbol="SLB"]');
    expect(panel.textContent).not.toContain('At deploy');
    expect(container.textContent).not.toContain('Top 2 stocks by BaggerBomb fit score');
  });

  it('MUTATION ROW (L4-F5) — the `Read the full check` door is wired on every row', () => {
    mount();
    click(rowButtonFor('SLB'));
    const panel = container.querySelector('[data-why-symbol="SLB"]');
    expect(panel.textContent).toContain('Read the full check');
    // …and since D-89 it opens the CHECK'S OWN CARD in the conversation, not
    // the panel above the board.
    const door = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('Read the full check'));
    click(door);
    expect(container.querySelector(`[data-tape-entry-id="${checkEntryId(LIVE_DOC.evaluations[0])}"]`)).toBeTruthy();
    expect(container.querySelector('[data-why-symbol="book"]')).toBeNull();
  });

  it('MUTATION ROW (L4-F7) — the row passes its DIRECTION, so a short would get no tier lines', () => {
    withDoc({ portfolio: { ...LIVE_DOC.portfolio,
      star: [{ symbol: 'AAPL' }, { symbol: 'SLB', swapPrice: 34.1, direction: 'short', swappedInAt: '2026-09-01T15:02:00.000Z' }],
    } });
    mount();
    click(rowButtonFor('SLB'));
    const panel = container.querySelector('[data-why-symbol="SLB"]');
    expect(panel.textContent).not.toContain('Bagger $');
    expect(panel.textContent).not.toContain('from the scoring path');
    // …while the same row long DOES get them (the guard is the direction, not
    // a missing baseline).
    DOC = LIVE_DOC;
    act(() => root.unmount());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mount();
    click(rowButtonFor('SLB'));
    expect(container.querySelector('[data-why-symbol="SLB"]').textContent).toContain('from the scoring path');
  });

  it('the tape is built from the doc\'s OWN chat exchanges — a filing lands between the runs it separates', () => {
    // NOT a guard on the `receipts` input (review FIX-5 corrected the earlier
    // claim): a directive filing IS a chat exchange, so it is a MESSAGE in the
    // merged stream and breaks the checks' adjacency by itself — dropping
    // `receipts` from the buildTape call leaves this render unchanged. The
    // disposition conjunct is guarded where it is composed, in
    // buildTape.test.js. What this row does prove is that the screen feeds the
    // tape the subscribed document's exchanges, evaluations and directive
    // together, and that the fold respects the message between them.
    const quiet = (hhmm) => ({
      evalId: `e_${hhmm}`, timestamp: `2026-09-01T${hhmm}:00.000Z`, decision: 'HOLD', downgraded: false,
      rationale: 'The book is holding its shape.', scores: { active: 1, banked: 40, total: 41 },
    });
    withDoc({
      evaluations: [quiet('14:00'), quiet('14:15'), quiet('14:30'), quiet('14:45')],
      trades: [],
      chatExchanges: [
        { userMessage: 'a', agentResponse: 'ok', hasDirective: true, directiveThreadId: 't-1', timestamp: '2026-09-01T13:50:00.000Z' },
        { userMessage: 'b', agentResponse: 'ok', hasDirective: true, directiveThreadId: 't-2', timestamp: '2026-09-01T14:20:00.000Z' },
      ],
      directive: { text: 'b', expiry: 'end_of_battle', directiveThreadId: 't-2' },
    });
    mount();
    const runs = [...container.querySelectorAll('[data-tape-kind="checkRun"]')];
    expect(runs).toHaveLength(2);
    expect(runs.map((r) => r.getAttribute('data-tape-run-count'))).toEqual(['2', '2']);
    // …and the exchange that filed the second directive is the thing between
    // them, which is what makes the two runs two.
    expect(container.textContent).toContain('b');
  });
});
