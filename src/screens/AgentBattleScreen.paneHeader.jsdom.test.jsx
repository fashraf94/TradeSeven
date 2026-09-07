// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.paneHeader.jsdom.test.jsx
//
// Smoke F2 — the header row's style contract, at 390 px and at 1280 px.
//
// The founder's first smoke: "the avatar and the agent's name are far apart;
// the name truncates (SHAD…, S..) under the segmented control." Both halves
// are ONE defect with one cause. EnvStage's root is `width: 100%; height: 100%`
// (src/components/AgentPresence/faceEnv.jsx:117) — the face takes its BOX from
// its parent and uses `size` only for the canvas it draws inside. Rendered bare
// as a flex item it therefore claims the whole row: the face drew small inside
// a huge box (so the mark and the name read as far apart) and every sibling was
// squeezed to nothing (so the name ellipsed). The two dashboard call sites had
// already met this and boxed it, with a comment naming the reason
// (IdentityPanel.jsx:80, EquipStation.jsx:218); A3's two new call sites —
// ArenaHeader and CharacterPane — did not.
//
// WHY THIS FILE EXISTS SEPARATELY: every other harness in this tree mocks
// `isAgentPresenceOn` FALSE, so in all of them the face never renders and its
// box is unguarded — which is exactly how the defect shipped. This file is the
// one that turns it on.
//
// jsdom does no layout, so what is asserted is the STYLE CONTRACT — the boxes,
// the flex, the absence of an ellipsis — not the pixels. The pixels want the
// founder's smoke. The two widths are asserted because the contract differs by
// shell (the archetype line, the face's size), not because jsdom measures them.

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
  // PRESENCE ON — the whole point of this file. It ships true
  // (featureFlags.js:1216), so this is the production shape, not a hypothetical.
  isAgentPresenceOn: () => true,
  isMatchupsBackdropOn: () => false,
  isBattleViewControllerOn: () => true,
  isCharacterPaneOn: () => true,
}));
// The face is a canvas stage and is not what this file is about; the BOX around
// it is. Mocking the mount to nothing leaves the box as real DOM.
vi.mock('../components/AgentPresence', () => ({
  AgentPresenceMount: () => null,
}));
vi.mock('../components/AgentPresence/AgentPresenceMount', () => ({ default: () => null }));
vi.mock('../services/eodhdAPI', () => ({
  stockAPI: { getMultipleStockPrices: vi.fn(async () => ({})), getMultipleCryptoPrices: vi.fn(async () => ({})) },
  POPULAR_CRYPTO: [],
}));
vi.mock('../components/Agent/LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

// A LONG single-token name, deliberately. `SHADOW` is what the founder saw
// truncate, but a name that fits proves nothing about a rule that says "never
// truncates" — the contract has to hold for the name that does not fit.
const AGENT_NAME = 'SHADOWBREAKER';
const DOC = {
  id: 'ab-1',
  status: 'active',
  activatedAt: '2026-09-01T13:30:00.000Z',
  agentContext: { agentName: AGENT_NAME, archetype: 'degen', equippedWatchlist: { name: 'Energy leaders', tickers: ['DVN'] } },
  scoreState: { currentScore: 12, opponentScore: 3, tradeCount: 1, evaluationCount: 5, lastScoredAt: '2026-09-01T16:47:00.000Z' },
  timing: { tradingDays: ['d1', 'd2', 'd3'], currentTradingDay: 2 },
  portfolio: { star: [{ symbol: 'AAPL' }], core: [], support: [], startingPrices: { AAPL: 150 }, bench: { stocks: [], crypto: null } },
  watchlist: { hotBench: [] },
  agentContext2: null,
  opponent: { portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [] } },
  evaluations: [],
  trades: [],
  statusFeed: [],
  chatExchanges: [],
};
vi.mock('../hooks/useAgentBattle', () => ({
  default: () => ({
    battle: DOC, statusFeed: [], executionMode: 'copilot', pendingProposal: null,
    strategyPreset: 'balanced', gameplanMeeting: null, chatExchanges: [], feedBookmarks: [], loading: false,
  }),
}));

import AgentBattleScreen from './AgentBattleScreen';
import {
  ARCHETYPE_MIN_VIEWPORT_PX,
  PANE_HEADER_FIXED_PX,
  PANE_ARCHETYPE_MIN_PX,
  PANE_VIEWPORT_SHARE,
} from './battleView/CharacterPane';

const BATTLE = {
  agentId: 'agent-1', agentBattleId: 'ab-1',
  creator: { portfolio: { star: [{ symbol: 'AAPL' }], core: [], support: [] } },
  opponent: { portfolio: { star: [{ symbol: 'MSFT' }], core: [], support: [] } },
  state: { startingPrices: { AAPL: 150 } },
};

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

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

/** Both halves of the breakpoint: useIsDesktop seeds from innerWidth at mount, then listens. */
const setWidth = (px) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: px });
  // EACH QUERY ON ITS OWN TERMS. There are two min-width queries now — 768 for
  // the shell, ARCHETYPE_MIN_VIEWPORT_PX for the archetype line's room — and a
  // harness that answered one boolean to both would have made the ordering row
  // below pass at any width.
  window.matchMedia = (query) => {
    const min = /min-width:\s*(\d+)px/.exec(String(query));
    return {
      matches: min ? px >= Number(min[1]) : px >= 768,
      addEventListener() {},
      removeEventListener() {},
    };
  };
};
const mount = () => act(() => {
  root.render(<AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />);
});
const openPane = () => {
  if (container.querySelector('[data-character-pane]')?.getAttribute('data-pane-open') === 'true') return;
  act(() => {
    container.querySelector('[data-character-mark]')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
};

/** A name that never truncates: no ellipsis, and a wrap that a single token can take. */
const expectNeverTruncates = (el) => {
  expect(el).toBeTruthy();
  expect(el.textContent).toBe(AGENT_NAME);
  // The three that made `SHAD…`. `textOverflow` is the one that painted the
  // ellipsis; the other two are what let it get there.
  expect(el.style.textOverflow).toBe('');
  expect(el.style.overflow).not.toBe('hidden');
  expect(el.style.whiteSpace).toBe('normal');
  // A single-token name has no break opportunity of its own, so plain wrapping
  // would overflow the cell instead — a worse failure than the ellipsis.
  expect(el.style.overflowWrap).toBe('anywhere');
};

describe('Smoke F2 — 1280 px: the face is boxed, the name is whole', () => {
  beforeEach(() => setWidth(1280));

  it('boxes the ARENA face to its own footprint, adjacent to the name', () => {
    mount();
    const box = container.querySelector('[data-arena-face]');
    expect(box).toBeTruthy();
    // The box the defect was missing. Unboxed, EnvStage's `width: 100%` root
    // claimed the row.
    expect(box.style.width).toBe('56px');
    expect(box.style.height).toBe('56px');
    // …and never gives that footprint back, or the face shrinks away from a
    // name that is now allowed to wrap.
    expect(box.style.flexShrink).toBe('0');
    // ADJACENCY: the identity column is the box's immediate next sibling, so
    // nothing can be inserted between the mark and the name it belongs to.
    expect(box.nextElementSibling?.contains(container.querySelector('[data-arena-agent-name]'))).toBe(true);
  });

  it('never truncates the agent name in the arena', () => {
    mount();
    expectNeverTruncates(container.querySelector('[data-arena-agent-name]'));
  });

  it('boxes the PANE face, gives the name the slack, and freezes the controls', () => {
    mount();
    openPane();
    const box = container.querySelector('[data-pane-face]');
    expect(box.style.width).toBe('36px');
    expect(box.style.height).toBe('36px');
    expect(box.style.flexShrink).toBe('0');
    expect(box.nextElementSibling?.getAttribute('data-pane-identity')).toBe('1');

    // The name block takes the room the boxed face and the content-sized
    // controls leave — `1 1 auto`, not the `0 1 auto` it shrank under.
    const identity = container.querySelector('[data-pane-identity]');
    expect(identity.style.flex).toBe('1 1 auto');
    expect(identity.style.minWidth).toBe('0px');

    // The segmented control is sized to its CONTENT and gives up nothing: three
    // tabs that shrink are three slivers.
    expect(container.querySelector('[data-pane-controls]').style.flexShrink).toBe('0');
  });

  it('never truncates the agent name in the pane header', () => {
    mount();
    openPane();
    expectNeverTruncates(container.querySelector('[data-pane-agent-name]'));
  });

  it('keeps the archetype line at this width', () => {
    mount();
    openPane();
    expect(container.querySelector('[data-pane-archetype]')).toBeTruthy();
  });
});

describe('F2\'s ruled ORDERING — the archetype goes first, the name keeps its room', () => {
  // The founder's ruling after the review. The first build read "on narrow
  // widths the archetype line hides first, then the name wraps" as the
  // desktop/mobile shell split, which is the INVERSE on a narrow desktop: the
  // archetype stayed and the name gave way. The review measured the cost at the
  // real breakpoint (768 — an iPad in portrait is a "desktop" and opens the pane
  // by default): the identity column collapsed to nothing, the name became a
  // vertical stack of single letters, the archetype's `nowrap` text painted over
  // the tabs, and the controls ran past the header's edge.
  //
  // These rows IMPORT the breakpoint and its parts rather than restating a
  // number, so the arithmetic and the behaviour cannot drift apart.

  it('derives the breakpoint from the header\'s own parts', () => {
    expect(ARCHETYPE_MIN_VIEWPORT_PX).toBe(
      Math.ceil((PANE_HEADER_FIXED_PX + PANE_ARCHETYPE_MIN_PX) / PANE_VIEWPORT_SHARE),
    );
    // …and it sits ABOVE the shell breakpoint, or the ruling would be a no-op:
    // every desktop would be roomy and the line would never go first.
    expect(ARCHETYPE_MIN_VIEWPORT_PX).toBeGreaterThan(768);
  });

  it('HIDES the archetype one pixel below the line, and keeps the name whole', () => {
    // The ruling in one row: the archetype is gone, and the name — which is
    // what the first build sacrificed instead — is untouched and untruncated.
    setWidth(ARCHETYPE_MIN_VIEWPORT_PX - 1);
    mount();
    openPane();
    expect(container.querySelector('[data-pane-shell]').getAttribute('data-pane-shell')).toBe('desktop');
    expect(container.querySelector('[data-pane-archetype]')).toBeNull();
    expectNeverTruncates(container.querySelector('[data-pane-agent-name]'));
  });

  it('SHOWS it one pixel above the line', () => {
    // The counter-row: a gate that always hid would pass the row above.
    setWidth(ARCHETYPE_MIN_VIEWPORT_PX);
    mount();
    openPane();
    expect(container.querySelector('[data-pane-archetype]')).toBeTruthy();
    expectNeverTruncates(container.querySelector('[data-pane-agent-name]'));
  });

  it('is STILL a desktop at the width where the line goes — the shell did not move', () => {
    // The seam is a SECOND query beside the shell gate, not a wider shell. If
    // the fix had simply raised the desktop breakpoint, the pane would become a
    // mobile overlay at 1024 and the whole layout would change with it.
    setWidth(1024);
    mount();
    openPane();
    expect(container.querySelector('[data-pane-shell]').getAttribute('data-pane-shell')).toBe('desktop');
    expect(container.querySelector('[data-pane-archetype]')).toBeNull();
    expect(container.querySelector('[data-chat-column]')).toBeTruthy();
    expect(container.querySelector('[data-pane-overlay]')).toBeNull();
  });

  it('the phone never shows it, at any width below the shell', () => {
    setWidth(390);
    mount();
    openPane();
    expect(container.querySelector('[data-pane-shell]').getAttribute('data-pane-shell')).toBe('mobile');
    expect(container.querySelector('[data-pane-archetype]')).toBeNull();
  });
});

describe('Smoke F2 — 390 px: the same contract, and the archetype goes first', () => {
  beforeEach(() => setWidth(390));

  it('boxes the ARENA face at the phone size, adjacent to the name', () => {
    mount();
    const box = container.querySelector('[data-arena-face]');
    expect(box.style.width).toBe('40px');
    expect(box.style.height).toBe('40px');
    expect(box.style.flexShrink).toBe('0');
    expect(box.nextElementSibling?.contains(container.querySelector('[data-arena-agent-name]'))).toBe(true);
  });

  it('never truncates the agent name in the arena', () => {
    mount();
    expectNeverTruncates(container.querySelector('[data-arena-agent-name]'));
  });

  it('boxes the PANE face and keeps the same three flex rules', () => {
    mount();
    openPane();
    const box = container.querySelector('[data-pane-face]');
    expect(box.style.width).toBe('36px');
    expect(box.style.height).toBe('36px');
    expect(box.style.flexShrink).toBe('0');
    expect(container.querySelector('[data-pane-identity]').style.flex).toBe('1 1 auto');
    expect(container.querySelector('[data-pane-controls]').style.flexShrink).toBe('0');
  });

  it('never truncates the agent name in the pane header', () => {
    mount();
    openPane();
    expectNeverTruncates(container.querySelector('[data-pane-agent-name]'));
  });

  it('DROPS the archetype line first — the phone header has the sections to fit', () => {
    // F2's ordering: the archetype goes before the name is asked to give
    // anything up. On the phone that is a shell gate, which is the repo's only
    // width idiom; see the note at the gate.
    mount();
    openPane();
    expect(container.querySelector('[data-pane-archetype]')).toBeNull();
    expect(container.querySelector('[data-pane-agent-name]')).toBeTruthy();
  });
});
