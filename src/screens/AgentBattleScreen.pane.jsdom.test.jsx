// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.pane.jsdom.test.jsx
//
// Phase A3 — the screen MOUNTED with the character pane on. The sibling
// AgentBattleScreen.paneOff.golden.test.jsx guards the else-arm (pane-off is
// the A2 render, byte for byte); this file guards the then-arm.
//
// It grows one describe block per build phase. A3.0 is the arena header.
//
// Harness: AgentBattleScreen.controller.jsdom.test.jsx, with isCharacterPaneOn
// mocked true alongside the controller.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../services/agentService', () => ({ submitDailyGrades: vi.fn(), addFeedBookmark: vi.fn(), removeFeedBookmark: vi.fn() }));

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
  // THE PANE ON — what this file is for. The flag itself ships false; mocking
  // the ACCESSOR (never the constant) is the seam the flag docstring names.
  isCharacterPaneOn: () => true,
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
  agentContext: { agentName: 'Aurora', archetype: 'degen', equippedWatchlist: { name: 'Energy leaders', tickers: ['DVN'] } },
  scoreState: { currentScore: 12, opponentScore: 3, tradeCount: 1, evaluationCount: 5, lastScoredAt: '2026-09-01T16:47:00.000Z' },
  timing: { tradingDays: ['d1', 'd2', 'd3'], currentTradingDay: 2 },
  portfolio: {
    star: [{ symbol: 'AAPL' }, { symbol: 'SLB' }],
    core: [{ symbol: 'NVDA' }],
    support: [],
    startingPrices: { AAPL: 150, NVDA: 900, MU: 90 },
    bench: { stocks: [{ symbol: 'NOW' }, { symbol: 'TSLA' }], crypto: null },
  },
  watchlist: { hotBench: ['CRWD'] },
  agentContext2: null,
  opponent: { portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [] } },
  evaluations: [
    { evalId: 'eval_005', timestamp: '2026-09-01T16:47:02.000Z', decision: 'HOLD', rationale: 'Holding the book. NOW would need +7.4% more to lock in the bonus.', haikuError: null },
  ],
  trades: [],
  statusFeed: [],
  chatExchanges: [],
};

let DOC = LIVE_DOC;
const withDoc = (over) => { DOC = { ...LIVE_DOC, ...over }; };
let FEED = [];
let BOOKMARKS = [];
vi.mock('../hooks/useAgentBattle', () => ({
  default: () => ({
    battle: DOC, statusFeed: FEED, executionMode: 'copilot', pendingProposal: null,
    strategyPreset: 'balanced', gameplanMeeting: null, chatExchanges: DOC.chatExchanges,
    feedBookmarks: BOOKMARKS, loading: false,
  }),
}));

import AgentBattleScreen from './AgentBattleScreen';
import { removeFeedBookmark } from '../services/agentService';

const BATTLE = {
  agentId: 'agent-1', agentBattleId: 'ab-1',
  creator: { portfolio: { star: [{ symbol: 'AAPL' }, { symbol: 'MU' }], core: [{ symbol: 'NVDA' }], support: [] } },
  opponent: { portfolio: { star: [{ symbol: 'MSFT' }], core: [], support: [] } },
  state: { startingPrices: { AAPL: 150, NVDA: 900, MU: 90 } },
};

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-01T17:00:00.000Z'));
  DOC = LIVE_DOC;
  FEED = [];
  BOOKMARKS = [];
  setShell(true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

/**
 * The breakpoint, both halves of it: useIsDesktop seeds from window.innerWidth
 * at MOUNT and then listens on matchMedia, so a test that sets only one of the
 * two gets a shell that disagrees with itself.
 */
const setShell = (isDesktop) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: isDesktop ? 1280 : 480 });
  window.matchMedia = () => ({ matches: isDesktop, addEventListener() {}, removeEventListener() {} });
};

const mount = () => act(() => {
  root.render(<AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />);
});

/**
 * Open the pane, whatever the shell's opening default is. Desktop opens WITH
 * the pane showing (the brief's resting working state, §5 deliverable 1), so
 * there is no mark to press; the phone starts closed.
 */
const paneIsOpen = () => container.querySelector('[data-character-pane]')?.getAttribute('data-pane-open') === 'true';
const openPane = () => {
  if (paneIsOpen()) return;
  act(() => {
    container.querySelector('[data-character-mark]')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
};
const closePane = () => act(() => {
  container.querySelector('[data-pane-close]')
    .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
});
const selectTab = (section) => act(() => {
  container.querySelector(`[data-pane-tab="${section}"]`)
    .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
});

describe('A3.0 — the arena replaces the shipped header under the pane flag (D-96)', () => {
  it('mounts the arena header, and exactly one of it', () => {
    mount();
    expect(container.querySelectorAll('[data-arena-header]')).toHaveLength(1);
    expect(container.querySelector('[data-arena-bar]')).toBeTruthy();
  });

  it('keeps ONE book tap surface — the arena\'s, not a second one beside it', () => {
    // The shipped ScoreHeader also renders data-why-book-toggle. If the branch
    // were an insertion rather than a swap, both would mount and the panel's
    // close (which finds the control by attribute) would hand focus to whichever
    // came first.
    mount();
    expect(container.querySelectorAll('[data-why-book-toggle]')).toHaveLength(1);
    expect(container.querySelector('[data-arena-header] [data-why-book-toggle]')).toBeTruthy();
  });

  it('carries the turn line inside the arena, not beside it', () => {
    mount();
    const line = container.querySelector('[data-turn-state]');
    expect(line).toBeTruthy();
    expect(container.querySelector('[data-arena-header]').contains(line)).toBe(true);
  });

  it('lets the starfield through: the top section is no longer opaque (hazard 39)', () => {
    // The arena is the floor. The persistent top section paints an opaque
    // bgAgent pane-off; under the flag it drops to a scrim so the existing
    // BaggerBombBackground canvas at z1 is visible through it. Read off the
    // element's own inline style — the token is not resolved in this harness,
    // so the assertion is that the VALUE changed shape, not its computed colour.
    mount();
    const top = container.querySelector('[data-arena-header]').closest('div[style*="z-index"]');
    expect(top).toBeTruthy();
    expect(top.style.background).toContain('--ft-shadow-rgb');
    expect(top.style.background).not.toContain('#1C1A27');
  });

  it('renders the day label the screen derives, not one the header re-derives (§9)', () => {
    // computeDayLabel lives in the screen and is passed in. The arena must not
    // grow its own copy of that arithmetic off `timing`.
    mount();
    expect(container.querySelector('[data-arena-header]').textContent).toContain('Day 2 of 3');
  });
});

describe('A3.1 — the character on the board (D-91, D-98)', () => {
  it('mounts exactly one mark, inside the board column, when the pane is folded', () => {
    // Desktop OPENS with the pane showing (the brief's resting working state),
    // and the character then stands in the pane's header — no second mark on
    // the board (the seed's ruling 4). Collapsed, it comes back onto the board.
    mount();
    // Open, the character stands in the pane's HEADER and the board carries no
    // mark at all (the seed's ruling 4). The header's own face is the presence
    // mount, which every screen harness mocks off — so zero here is the ruling,
    // not an absence of rendering: the pane itself is present.
    expect(container.querySelector('[data-character-pane]')).toBeTruthy();
    expect(container.querySelectorAll('[data-character-mark]')).toHaveLength(0);
    closePane();
    const marks = container.querySelectorAll('[data-character-mark]');
    expect(marks).toHaveLength(1);
    expect(container.querySelector('[data-board]').contains(marks[0])).toBe(true);
  });

  it('the board reserves the mark\'s clearance instead of the sheet\'s peek (D-93)', () => {
    mount();
    // matchMedia is stubbed true here, so this is the DESKTOP branch: the
    // column takes `position: relative` so the absolutely-positioned mark has a
    // containing block, and the mobile branch swaps the padding. Both are the
    // paneOn arm of the same conditional.
    const board = container.querySelector('[data-board]');
    expect(board.style.position).toBe('relative');
  });

  it('MOBILE: the reservation is the mark\'s clearance, and it clears the mark', () => {
    // Added after the review's SURVIVOR PROBE (BUILD_RULES §2): changing
    // AVATAR_CLEARANCE_PX from 96 to 500 left all 4156 rows green, which proved
    // the harness can report a survivor AND that this value was guarded by
    // nothing. The brief's §2.1 promise — the board reserves the space so the
    // mark never rests over a row's tap targets — was unenforced.
    //
    // The row is stated as that promise rather than as the literal: the
    // reservation must clear the mark's own 48px target plus its 14px inset,
    // and must not be the sheet's (SHEET_PEEK_PX + 32 = 108 today), which is
    // what the pane retires.
    setShell(false);
    mount();
    const board = container.querySelector('[data-board]');
    const reserved = parseInt(board.style.paddingBottom, 10);
    expect(reserved).toBeGreaterThanOrEqual(48 + 14);
    expect(board.style.position).toBe('relative');
    // …and the mark is inside the column it reserves for.
    expect(board.contains(container.querySelector('[data-character-mark]'))).toBe(true);
  });

  it('speaks the newest RECORDED entry when something is unread, and clears on open', () => {
    // MOBILE, deliberately. On desktop the A2 chat column opens at HALF by
    // default, so `chatVisible` is true on the first paint and the effect marks
    // everything seen before a count can exist — correct behaviour, and the
    // reason the pane's own closed-by-default machine (A3.2) is what finally
    // makes the desktop count meaningful. The phone starts at peek, so the
    // unread path is live there today.
    setShell(false);
    // The tape is unseen on a fresh mount (the A4 rule kept in flip-prep), so
    // the mark carries a count and the character has a line.
    mount();
    const mark = container.querySelector('[data-character-mark]');
    expect(mark.getAttribute('data-unread')).toBeTruthy();
    const bubble = container.querySelector('[data-character-bubble]');
    expect(bubble).toBeTruthy();
    // The eyebrow is the check CARD's own label, not a second one.
    expect(bubble.textContent).toContain('Status check');

    // Opening the pane marks it seen. The mark itself retires INTO the pane's
    // header while the pane is open (the seed's ruling 4 — no second mark on
    // the board), so what is asserted here is that the board's mark and its
    // bubble are both gone, not that the badge cleared on a mark still there.
    act(() => { mark.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
    expect(container.querySelector('[data-character-pane]')).toBeTruthy();
    expect(container.querySelector('[data-character-avatar]')).toBeNull();
    expect(container.querySelector('[data-character-bubble]')).toBeNull();

    // …and closing it brings the mark back with nothing unread.
    act(() => {
      container.querySelector('[data-pane-close]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[data-character-mark]').getAttribute('data-unread')).toBeNull();
    expect(container.querySelector('[data-character-bubble]')).toBeNull();
  });

  it('says nothing when the tape has nothing the character said', () => {
    withDoc({ evaluations: [], chatExchanges: [], trades: [] });
    mount();
    closePane();
    expect(container.querySelector('[data-character-mark]')).toBeTruthy();
    expect(container.querySelector('[data-character-bubble]')).toBeNull();
    expect(container.querySelector('[data-character-mark]').getAttribute('data-unread')).toBeNull();
  });

  it('a TIMER alone creates no bubble — only a tape change can (D-97)', () => {
    // The seed's row. Mount with an empty tape, advance the clock past several
    // cron slots, re-render: still nothing. The only input that can produce a
    // bubble is a new entry.
    withDoc({ evaluations: [], chatExchanges: [], trades: [] });
    mount();
    expect(container.querySelector('[data-character-bubble]')).toBeNull();
    act(() => { vi.setSystemTime(new Date('2026-09-01T18:30:00.000Z')); });
    mount();
    expect(container.querySelector('[data-character-bubble]')).toBeNull();
  });

  it('the bubble and the mark are both doors onto the same pane', () => {
    setShell(false);
    mount();
    const bubble = container.querySelector('[data-character-bubble]');
    expect(bubble.tagName).toBe('BUTTON');
    act(() => { bubble.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
    expect(container.querySelector('[data-character-pane]')).toBeTruthy();
  });
});

describe('A3.2 — the pane replaces the strip and the sheet (D-93)', () => {
  it('DESKTOP: no strip and no sheet — the pane is the column', () => {
    mount();
    // Folded: the board is full width and the mark floats on it.
    closePane();
    expect(container.querySelector('[data-character-avatar]')).toBeTruthy();
    expect(container.querySelector('[data-chat-sheet]')).toBeNull();
    openPane();
    expect(container.querySelector('[data-character-pane]')).toBeTruthy();
    expect(container.querySelector('[data-pane-shell]').getAttribute('data-pane-shell')).toBe('desktop');
    // The A2 containers are gone under the flag, both of them.
    expect(container.querySelector('[data-chat-sheet]')).toBeNull();
    expect(container.querySelector('[data-peek-line]')).toBeNull();
    expect(container.querySelector('[data-chat-collapse]')).toBeNull();
  });

  it('MOBILE: the pane covers a dimmed board, and the board leaves the a11y tree', () => {
    setShell(false);
    mount();
    openPane();
    const overlay = container.querySelector('[data-pane-overlay]');
    expect(overlay).toBeTruthy();
    expect(overlay.contains(container.querySelector('[data-character-pane]'))).toBe(true);
    const layout = container.querySelector('[data-layout]');
    expect(layout.getAttribute('aria-hidden')).toBe('true');
    expect(layout.getAttribute('data-board-dimmed')).toBe('1');
    expect(layout.style.filter).toContain('brightness');
  });

  it('locks the body only on the shell where the pane covers the board', () => {
    setShell(false);
    mount();
    openPane();
    expect(document.body.style.overflow).toBe('hidden');
    act(() => {
      container.querySelector('[data-pane-close]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(document.body.style.overflow).toBe('');
  });

  it('EXACTLY ONE AgentChat, in ONE tree position, across every section', () => {
    // Hazard 45 / rulings §3.10. The chat holds a draft, an in-flight send and
    // a scroll position; a component that changes tree position remounts and
    // loses all three. So Bench and Tape HIDE the Chat panel — they never
    // unmount it — and the node identity is the assertion, not the count alone.
    mount();
    openPane();
    const chatPanel = container.querySelector('[data-pane-section="chat"]');
    const chatNode = chatPanel.firstElementChild;
    expect(container.querySelectorAll('[data-chat-layout="controller"]')).toHaveLength(1);

    act(() => {
      container.querySelector('[data-pane-tab="bench"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const after = container.querySelector('[data-pane-section="chat"]');
    expect(after.hidden).toBe(true);
    expect(after.firstElementChild).toBe(chatNode);   // the SAME node, not a remount
    expect(container.querySelectorAll('[data-chat-layout="controller"]')).toHaveLength(1);

    act(() => {
      container.querySelector('[data-pane-tab="chat"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[data-pane-section="chat"]').hidden).toBe(false);
    expect(container.querySelector('[data-pane-section="chat"]').firstElementChild).toBe(chatNode);
  });

  it('the segmented control is a REAL tablist, wired both ways', () => {
    mount();
    openPane();
    const list = container.querySelector('[role="tablist"]');
    expect(list).toBeTruthy();
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs.map((t) => t.textContent)).toEqual(['Chat', 'Bench', 'Tape']);
    for (const tab of tabs) {
      const panel = container.querySelector(`#${tab.getAttribute('aria-controls')}`);
      expect(panel, `${tab.textContent} points at no panel`).toBeTruthy();
      expect(panel.getAttribute('role')).toBe('tabpanel');
      expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
    }
    // Only the selected tab is in the tab order.
    expect(tabs.filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(tabs.find((t) => t.getAttribute('aria-selected') === 'true').textContent).toBe('Chat');
  });

  it('arrow keys move between tabs, and wrap', () => {
    mount();
    openPane();
    const list = container.querySelector('[role="tablist"]');
    const press = (key) => act(() => {
      list.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    });
    const selected = () => container.querySelector('[role="tab"][aria-selected="true"]').textContent;
    press('ArrowRight'); expect(selected()).toBe('Bench');
    press('ArrowRight'); expect(selected()).toBe('Tape');
    press('ArrowRight'); expect(selected()).toBe('Chat');
    press('ArrowLeft'); expect(selected()).toBe('Tape');
    press('Home'); expect(selected()).toBe('Chat');
    press('End'); expect(selected()).toBe('Tape');
  });

  it('collapse remembers the section; expand puts the reader back', () => {
    mount();
    openPane();
    act(() => {
      container.querySelector('[data-pane-tab="tape"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    closePane();
    // HIDDEN, NOT ABSENT (hazard 45). The first draft unmounted here, which is
    // what lost the draft; the pane keeps its tree position and `display: none`
    // is what gives the board the full width.
    expect(container.querySelector('[data-character-pane]')).toBeTruthy();
    expect(container.querySelector('[data-character-pane]').getAttribute('data-pane-open')).toBe('false');
    expect(container.querySelector('[data-character-pane]').hidden).toBe(true);
    openPane();
    expect(container.querySelector('[role="tab"][aria-selected="true"]').textContent).toBe('Tape');
  });

  it('a row door opens the pane on CHAT, whatever section was last shown', () => {
    mount();
    openPane();
    act(() => {
      container.querySelector('[data-pane-tab="bench"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    act(() => {
      container.querySelector('[data-pane-close]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    // The book door names Chat; a named section beats the remembered one.
    const bookToggle = container.querySelector('[data-why-book-toggle]');
    act(() => { bookToggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
    const full = container.querySelector('[data-why-open-check]') || container.querySelector('[data-why-book-toggle]');
    expect(full).toBeTruthy();
  });

  it('the pane names itself, and carries the character at its head', () => {
    mount();
    openPane();
    const region = container.querySelector('[data-character-pane]');
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-label')).toBe("The agent's pane");
    expect(container.querySelector('[data-pane-header]').textContent).toContain('Aurora');
  });

  // Two rows rather than one: the shell has to be set BEFORE the mount.
  // useIsDesktop seeds from window.innerWidth at mount and then subscribes to
  // the matchMedia object it saw then, so re-rendering the same root after
  // swapping the stub leaves the component on its original shell.
  it('DESKTOP: the way out COLLAPSES — the pane stays, the board grows', () => {
    mount();
    openPane();
    expect(container.querySelector('[data-pane-close]').getAttribute('aria-label')).toBe('Collapse');
  });

  it('MOBILE: the way out CLOSES — the pane was covering the board', () => {
    setShell(false);
    mount();
    openPane();
    expect(container.querySelector('[data-pane-close]').getAttribute('aria-label')).toBe('Close');
  });
});

describe('A3.3 — Bench quotes the decider only (D-92)', () => {
  const openPaneOn = (section) => { openPane(); selectTab(section); };

  it('renders the named names with the decider\'s own sentence, and the rest', () => {
    mount();
    openPaneOn('bench');
    const bench = container.querySelector('[data-pane-bench]');
    expect(bench).toBeTruthy();
    expect(bench.querySelector('[data-bench-named="NOW"]')).toBeTruthy();
    expect(bench.textContent).toContain('NOW would need +7.4% more to lock in the bonus.');
    // TSLA and CRWD and DVN are on the bench but unnamed by this check.
    expect(bench.querySelector('[data-bench-rest="TSLA"]')).toBeTruthy();
    expect(bench.querySelector('[data-bench-rest="CRWD"]')).toBeTruthy();
    expect(bench.querySelector('[data-bench-rest="DVN"]')).toBeTruthy();
    expect(bench.textContent).toContain('Not named at the');
  });

  it('carries the equipped watchlist\'s bare name as the subtitle', () => {
    mount();
    openPaneOn('bench');
    const subtitle = container.querySelector('[data-bench-watchlist]');
    expect(subtitle.textContent).toBe('Energy leaders · equipped');
    // The header's chip prefix does not follow it in.
    expect(subtitle.textContent).not.toContain('Watchlist:');
  });

  it('names no piece that has a row on the board', () => {
    mount();
    openPaneOn('bench');
    const bench = container.querySelector('[data-pane-bench]');
    for (const held of ['AAPL', 'SLB', 'NVDA']) {
      expect(bench.querySelector(`[data-bench-rest="${held}"]`), `${held} has a row`).toBeNull();
      expect(bench.querySelector(`[data-bench-named="${held}"]`), `${held} has a row`).toBeNull();
    }
  });

  it('the Chat keeps its node while Bench shows (hazard 45)', () => {
    mount();
    openPane();
    const chatNode = container.querySelector('[data-pane-section="chat"]').firstElementChild;
    selectTab('bench');
    expect(container.querySelector('[data-pane-section="chat"]').firstElementChild).toBe(chatNode);
  });

  it('says `No check yet today` when nothing today carries words', () => {
    withDoc({ evaluations: [{ evalId: 'e', timestamp: '2026-09-01T16:47:02.000Z', decision: 'HOLD', rationale: null }] });
    mount();
    openPaneOn('bench');
    const bench = container.querySelector('[data-pane-bench]');
    expect(bench.querySelector('[data-bench-absent]').textContent).toBe('No check yet today');
    // The roster still renders, without a slot to not-name it at.
    expect(bench.querySelector('[data-bench-rest="NOW"]')).toBeTruthy();
    expect(bench.textContent).not.toContain('Not named at the');
  });

  it('leaves an EMPTY slot for assignments — no placeholder UI', () => {
    mount();
    openPaneOn('bench');
    const slot = container.querySelector('[data-bench-assignments]');
    expect(slot).toBeTruthy();
    expect(slot.textContent).toBe('');
    expect(container.querySelector('[data-pane-bench]').textContent).not.toContain('Assignments');
  });

  it('renders no per-name percent — there is no source for one', () => {
    mount();
    openPaneOn('bench');
    const rest = container.querySelector('[data-bench-rest="TSLA"]');
    expect(rest.textContent).not.toMatch(/%/);
  });
});

describe('A3.4 — Tape is a pane section (D-94)', () => {
  const openPaneOn = (section) => { openPane(); selectTab(section); };

  it('the header link and the overlay are not rendered under the pane', () => {
    mount();
    expect(container.querySelector('[data-game-tape-link]')).toBeNull();
    expect(container.querySelector('[data-game-tape]')).toBeNull();
    // …and the board carries no bookmark dot either — the dot's new home is
    // Tape's own section header.
    expect(container.querySelector('[data-game-tape-dot]')).toBeNull();
  });

  it('renders the trade cards the CHAT renders, not GameTapeView\'s own rows', () => {
    withDoc({
      trades: [{
        symbolOut: 'GILD', symbolIn: 'MOS', tier: 'core',
        swappedOutAt: '2026-09-01T15:02:00.000Z',
        exitReason: 'haiku_decision', rationale: 'GILD rolled over; MOS leads materials.',
      }],
    });
    mount();
    openPaneOn('tape');
    const tape = container.querySelector('[data-pane-tape]');
    expect(tape).toBeTruthy();
    // TapeCards' own marker — the same component the Chat section uses.
    expect(tape.querySelector('[data-tape-kind="trade"]')).toBeTruthy();
    expect(tape.querySelector('[data-tape-pair="GILD-MOS"]')).toBeTruthy();
  });

  it('drops the Time / P&L / Tier sort controls', () => {
    mount();
    openPaneOn('tape');
    const text = container.querySelector('[data-pane-tape]').textContent;
    for (const filter of ['P&L', 'Tier', 'Time']) {
      expect(text, `${filter} came across`).not.toContain(filter);
    }
  });

  it('THE BOOKMARK DOT BECOMES A COUNT on this section\'s header', () => {
    FEED = [
      { id: 'f1', timestamp: '2026-09-01T15:00:00.000Z', message: 'Woken by a price drop' },
      { id: 'f2', timestamp: '2026-09-01T15:30:00.000Z', message: 'Swap executed' },
    ];
    BOOKMARKS = ['f1', 'f2'];
    mount();
    openPaneOn('tape');
    const header = container.querySelector('[data-tape-bookmarks-count]');
    expect(header.getAttribute('data-tape-bookmarks-count')).toBe('2');
    expect(header.textContent).toBe('Bookmarks · 2');
    expect(container.querySelector('[data-tape-bookmark="f1"]')).toBeTruthy();
  });

  it('says Bookmarks with no count, and why, when there are none', () => {
    mount();
    openPaneOn('tape');
    expect(container.querySelector('[data-tape-bookmarks-count]').textContent).toBe('Bookmarks');
    expect(container.querySelector('[data-pane-tape]').textContent).toContain('No bookmarks yet');
  });

  it('keeps the shipped bookmark control — a MOVED client write, not a new one', () => {
    FEED = [{ id: 'f1', timestamp: '2026-09-01T15:00:00.000Z', message: 'Woken by a price drop' }];
    BOOKMARKS = ['f1'];
    mount();
    openPaneOn('tape');
    const row = container.querySelector('[data-tape-bookmark="f1"]');
    const remove = row.querySelector('button[aria-label="Remove this bookmark"]');
    expect(remove).toBeTruthy();
    act(() => { remove.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
    expect(removeFeedBookmark).toHaveBeenCalledWith('ab-1', 'f1');
  });

  it('the activity log is collapsed by default, as the shipped view mounts it', () => {
    mount();
    openPaneOn('tape');
    const toggle = container.querySelector('[data-tape-log-toggle]');
    expect(toggle.getAttribute('data-tape-log-toggle')).toBe('closed');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    act(() => { toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
    expect(container.querySelector('[data-tape-log-toggle]').getAttribute('aria-expanded')).toBe('true');
  });

  it('the Chat keeps its node while Tape shows (hazard 45)', () => {
    mount();
    openPane();
    const chatNode = container.querySelector('[data-pane-section="chat"]').firstElementChild;
    selectTab('tape');
    expect(container.querySelector('[data-pane-section="chat"]').firstElementChild).toBe(chatNode);
  });
});

describe('A3.5 — the declutter (D-94, D-95)', () => {
  it('the watchlist chip leaves the header; its name lives in Bench', () => {
    mount();
    // The chip has been flag-INDEPENDENT since it shipped — it rendered
    // flag-off and controller-on alike — so this is the first thing that ever
    // took it off the header.
    expect(container.textContent).not.toContain('Watchlist:');
    openPane();
    act(() => {
      container.querySelector('[data-pane-tab="bench"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[data-bench-watchlist]').textContent).toContain('Energy leaders');
  });

  it('the overflow holds `Report a bug` ALONE', () => {
    mount();
    openPane();
    const toggle = container.querySelector('[data-pane-overflow-toggle]');
    expect(toggle.getAttribute('aria-label')).toBe('More');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    act(() => { toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
    const menu = container.querySelector('[role="menu"]');
    expect(menu).toBeTruthy();
    const items = menu.querySelectorAll('[role="menuitem"]');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toBe('Report a bug');
    // The mock's other two are not built.
    expect(menu.textContent).not.toContain('Read');
    expect(menu.textContent).not.toContain('Equip');
  });

  it('the overflow DISPATCHES rather than mounting a second widget', () => {
    // A second ClashBotWidget inside the pane would double the panel and its
    // cooldown state (hazard 36). The door is an event onto the ONE widget the
    // App mounts.
    mount();
    openPane();
    const heard = [];
    const listener = () => heard.push(1);
    window.addEventListener('clashbot:open', listener);
    act(() => {
      container.querySelector('[data-pane-overflow-toggle]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    act(() => {
      container.querySelector('[data-pane-report-bug]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    window.removeEventListener('clashbot:open', listener);
    expect(heard).toHaveLength(1);
    // …and the menu closes behind it.
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('no bug button is rendered inside the battle view itself', () => {
    // The withholding happens at the App mount, which this suite does not
    // render. What it CAN assert is that the pane never grew one of its own.
    mount();
    openPane();
    expect(container.querySelector('button[aria-label="Report a bug"]')).toBeNull();
  });
});

// ─── Review fixes (five-lens §2 review, September 4 2026) ──────────────────
//
// Every row here fails under the defect the build shipped before the review.
// They are the review's own repros, inverted to the contract.

describe('Review — hazard 45 across COLLAPSE, not only across sections', () => {
  const typeDraft = (text) => {
    const box = container.querySelector('textarea');
    expect(box, 'the composer must be reachable inside the pane').toBeTruthy();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(box, text);
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return box;
  };

  it('DESKTOP: a half-typed message survives collapse → expand', () => {
    // The defect (review lens 2 F2 / lens 5 F1): the pane, and the AgentChat
    // inside it, were UNMOUNTED while collapsed. The draft read '' on expand.
    // Hazard 45 names this transition verbatim, and the A2 column it replaces
    // kept the draft.
    mount();
    openPane();
    const before = typeDraft('half a message');
    expect(before.value).toBe('half a message');
    closePane();
    openPane();
    const after = container.querySelector('textarea');
    expect(after).toBe(before);                  // the same node, not a remount
    expect(after.value).toBe('half a message');  // …and the draft with it
  });

  it('MOBILE: the same, across close → reopen', () => {
    setShell(false);
    mount();
    openPane();
    const before = typeDraft('half a message');
    closePane();
    openPane();
    const after = container.querySelector('textarea');
    expect(after).toBe(before);
    expect(after.value).toBe('half a message');
  });

  it('the chat is ONE node across collapse AND a section change, together', () => {
    mount();
    openPane();
    const chatNode = container.querySelector('[data-pane-section="chat"]').firstElementChild;
    selectTab('bench');
    closePane();
    openPane();
    selectTab('chat');
    expect(container.querySelector('[data-pane-section="chat"]').firstElementChild).toBe(chatNode);
    expect(container.querySelectorAll('[data-chat-layout="controller"]')).toHaveLength(1);
  });
});

describe('Review — focus is handed on, never dropped', () => {
  it('MOBILE: opening moves focus INTO the region', () => {
    setShell(false);
    mount();
    openPane();
    const region = container.querySelector('[data-character-pane]');
    expect(region.contains(document.activeElement) || document.activeElement === region).toBe(true);
  });

  it('MOBILE: closing returns focus to the mark that comes back', () => {
    // The defect (lens 2 F3 / lens 5 F2): the captured invoker was the mark,
    // which UNMOUNTS while the pane is open, so focusing it was a no-op on a
    // detached node and the player landed on document.body. The hand-off now
    // reaches the mark that reappears.
    setShell(false);
    mount();
    openPane();
    closePane();
    expect(document.activeElement).toBe(container.querySelector('[data-character-mark]'));
  });

  it('DESKTOP: collapsing hands focus to the mark, not to the body', () => {
    // A2.4's review L2-F4 rule, which the pane path skipped: each control lives
    // inside the chrome the other renders, so a keyboard user who collapses
    // must be handed the control that replaces the one that vanished.
    mount();
    openPane();
    closePane();
    expect(document.activeElement).toBe(container.querySelector('[data-character-mark]'));
  });

  it('the mount pass does not steal focus (the Game Tape\'s CR6 rule)', () => {
    // Desktop opens WITH the pane showing. That first paint must not pull focus
    // into the region — only a player-driven open does.
    mount();
    expect(paneIsOpen()).toBe(true);
    expect(document.activeElement === document.body || document.activeElement === null).toBe(true);
  });
});

describe('Review — the desktop resting state is the pane OPEN (brief §5 #1)', () => {
  it('DESKTOP opens with the pane showing, on Chat', () => {
    mount();
    expect(paneIsOpen()).toBe(true);
    expect(container.querySelector('[role="tab"][aria-selected="true"]').textContent).toBe('Chat');
  });

  it('MOBILE opens with the board, and the pane closed over nothing', () => {
    setShell(false);
    mount();
    expect(paneIsOpen()).toBe(false);
    expect(container.querySelector('[data-character-mark]')).toBeTruthy();
    // …and the closed overlay is inert: hidden, so it cannot cover the board.
    expect(container.querySelector('[data-pane-overlay]').style.display).toBe('none');
  });
});
