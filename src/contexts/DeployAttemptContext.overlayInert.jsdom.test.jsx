// @vitest-environment jsdom
//
// The S8 fix build, ruling R-S8F-5 (the S8 review's S8-14 and S8-15, option (b)) — what the deploy provider's two
// overlays, the due-idea screen and the root ceremony, leave interactive behind them, and where focus goes when they
// close. The REAL DueIdeaInterstitial, the REAL DeployCeremony, the REAL useModalFocus, the REAL hub overlay stack and,
// for S8-14, the REAL Scouting Board; the deploy service, the verifier, the owned read and the due-idea read are
// stand-ins a row answers.
//
// jsdom implements no `inert`. A browser refuses focus to an inert element (HTML: "inert nodes cannot be focused"), and
// both findings turn on that, so this file teaches jsdom the one rule: focus() on an element inside [inert] does
// nothing. Nothing else is changed.
//
//   S8-14  while an overlay is up, every child of <body> but its own root is inert — the app root, and the portal of a
//          hub sheet beneath it (the Scouting Board, whose footer opens the due-idea screen over it), so one Shift+Tab
//          from the screen cannot reach the board's Close;
//   S8-15  on close the inert goes first, then focus returns to the control the sequence was opened from, or, gone or
//          disabled, to the hub's shell — never left on <body> under a page that was still inert at the overlay's own
//          restore;
//   K-5    the S8 review's 6 × 2 rows, rebuilt: with each hub sheet beneath (history and activity, registered by their
//          own root; record, archetype, watchlist and the Scouting Board, registered within the hub), the app root is
//          inert while either is open, in both closing orders, and nothing is left inert once both have closed.

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';

const h = vi.hoisted(() => ({
  authListeners: [],
  deploy: null,
  due: null,
  targetProgress: { deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: false },
}));

vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth, cb) => { h.authListeners.push(cb); return () => {}; } }));
vi.mock('../firebase/config', () => ({ db: {}, auth: { currentUser: { uid: 'uid-A' } } }));
vi.mock('../services/agentDeploy', () => ({ deployAgent: (...args) => h.deploy(...args) }));
vi.mock('../services/dueIdeaCheck', () => ({ checkDueIdea: async () => h.due, readDueIdea: async () => h.due }));
vi.mock('../services/hypothesisVersionService', () => ({ reaffirmHypothesis: vi.fn(), transitionHypothesis: vi.fn(), newOpId: () => 'op' }));
vi.mock('../services/agentBattleVerify', () => ({ findActiveBattleForAgent: async () => ({ found: false, battle: null }) }));
vi.mock('../services/ownedBattleRead', () => ({ readOwnedBattle: async () => null }));
vi.mock('../hooks/useDeployTargetProgress', () => ({ default: () => h.targetProgress }));
vi.mock('../components/Research/useMarketContext', () => ({ default: () => ({ marketContext: null }) }));
vi.mock('../components/Dashboard/deployCeremony/ceremonyData', async (importOriginal) => ({
  ...(await importOriginal()),
  useEquippedWatchlistSymbols: () => ({ symbols: [] }),
}));
// The board's own read stays pending: only its frame and its footer matter here.
vi.mock('../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn(() => new Promise(() => {})) }));
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isDeploySkyCouplingOn: () => false,
  isDeployCeremonyOn: () => true,
}));

import { resetAuthIdentityForTests } from '../services/authIdentity';
import { __resetHoldClaim } from '../hooks/holdClaim';
import { DeployAttemptProvider } from './DeployAttemptContext';
import { MotionGlobalConfig } from 'framer-motion';
import ScoutingBoardSheet from '../components/Dashboard/ScoutingBoardSheet';
import { HUB_DEPLOY_CONTROLS } from '../components/CommandCenter/hub/useHubDeploy';
import { FakeHub, HubRoot, StackProbe, createFrames } from '../components/CommandCenter/__fixtures__/deployAttemptKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.setConfig({ testTimeout: 30000 });

const T0 = 1_800_000_000_000;
const CARD = HUB_DEPLOY_CONTROLS.CARD;
const DUE = { watchlistId: 'wl-1', version: 2, currentVersion: 2, title: 'Rates stay higher for longer' };
/** A refusal that names its own wait: the hold stays disabled for 90 s after the ceremony closes. */
const LIMITER_429 = () => ({ outcome: 'refused', success: false, postIssued: true, httpStatus: 429, status: 429, error: 'Too many requests', retryAfter: 90 });
const COOLDOWN_429 = () => ({ outcome: 'refused', success: false, postIssued: true, httpStatus: 429, status: 429, error: 'Please wait 2 minutes between deploys', reason: 'cooldown' });

// A browser refuses focus to an inert element; jsdom does not know `inert`. Teach it that one rule.
const nativeFocus = HTMLElement.prototype.focus;
beforeAll(() => {
  HTMLElement.prototype.focus = function focusUnlessInert(options) {
    if (this.closest('[inert]')) return undefined;
    return nativeFocus.call(this, options);
  };
});
afterAll(() => { HTMLElement.prototype.focus = nativeFocus; });

let nowMs;
let frames;
let container;
let root;
let probe;
/** The hub's overlay stack, as the hub's sheets register with it. */
const stackProbe = { current: null };
let board;
let posts;
let boardCloses;

const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { await act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); }); };
const advance = async (ms) => { await act(async () => { nowMs += ms; vi.advanceTimersByTime(ms); }); };
const signIn = (uid) => act(() => { for (const cb of [...h.authListeners]) cb(uid ? { uid } : null); });
const button = (label, scope = document.body) => [...scope.querySelectorAll('button')].find((b) => (b.textContent || '').includes(label) || b.getAttribute('aria-label') === label);
const shell = () => document.querySelector('[data-hub="shell"]');
const hold = () => document.querySelector(`[data-control="${CARD}"] button`);
const dueRoot = () => document.querySelector('body > .due-idea-interstitial');
const ceremonyRoot = () => document.querySelector('body > .deploy-ceremony-overlay');
const bodyChild = (el) => (el ? el.closest('body > *') : null);
const inert = (el) => Boolean(el) && el.hasAttribute('inert');
const inertChildren = () => [...document.body.children].filter((el) => el.hasAttribute('inert'));
/** The refused answer through the real ceremony: its 0.1 s + 0.4 s verifier look, then its terminal with "Back to hub". */
const refuseAndSettle = async (answer = COOLDOWN_429()) => {
  posts[0].answer(answer);
  await flush();
  await advance(100);
  await flush();
  await advance(400);
  await flush();
  await flush();
};

/** The hub's shell as the stand-in kit draws it, with the hub's overlay stack and a controlled Scouting Board inside. */
function Shell() {
  const [boardOpen, setBoardOpen] = useState(false);
  board = { open: () => act(() => { setBoardOpen(true); }), close: () => act(() => { setBoardOpen(false); }) };
  return (
    <div data-hub="shell" tabIndex={-1}>
      <FakeHub controls={[CARD]} probe={probe} />
      <StackProbe probe={stackProbe} />
      {/* The hub's "See what it's eyeing": the board's opener, as the stack holds it. */}
      <button type="button" data-board-opener="">See what it&apos;s eyeing</button>
      <ScoutingBoardSheet
        open={boardOpen}
        // As the hub closes it (hub/useHubSheets.js): the stack's close, focus included, then the sheet.
        onClose={() => { boardCloses += 1; stackProbe.current?.close('legacy:scouting', { fallback: shell() }); setBoardOpen(false); }}
        agent={{ archetype: 'momentum_chaser' }}
        accent="#22c55e"
        deploying={false}
        deployDisabled={false}
        isLive={false}
        onDeploy={() => probe.current.deploy.tap(HUB_DEPLOY_CONTROLS.SCOUTING_BOARD, { exemptOverlay: true })}
      />
    </div>
  );
}

beforeEach(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  }
  resetAuthIdentityForTests();
  __resetHoldClaim();
  h.authListeners = [];
  h.due = null;
  h.targetProgress = { deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: false };
  posts = [];
  boardCloses = 0;
  h.deploy = vi.fn((agentId, onCreate, onTarget) => {
    const d = deferred();
    posts.push({ agentId, answer: d.resolve });
    onTarget?.(agentId);
    return d.promise;
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  nowMs = T0;
  vi.setSystemTime(T0);
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  frames = createFrames();
  vi.stubGlobal('requestAnimationFrame', frames.request);
  vi.stubGlobal('cancelAnimationFrame', frames.cancel);
  probe = { current: null };
  stackProbe.current = null;
  container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const bridge = { onCreateAgentBattle: vi.fn(() => 'battle-new'), onEnterBattle: vi.fn(), onOpenBattle: vi.fn(), refreshActiveBattles: vi.fn(), clearCeremonyStash: vi.fn(), userName: 'flash' };
  act(() => {
    root.render(
      <DeployAttemptProvider hubEnabled {...bridge}>
        <HubRoot><Shell /></HubRoot>
      </DeployAttemptProvider>,
    );
  });
  signIn('uid-A');
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  for (const el of [...document.body.children]) el.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The tap that opens the provider's overlay, from a control that has focus (or, null, from wherever focus is). */
async function tapFrom(control, controlId = CARD, options = {}) {
  if (control) {
    act(() => { control.focus(); });
    expect(document.activeElement).toBe(control);
  }
  act(() => { probe.current.deploy.tap(controlId, options); });
  await flush();
  act(() => { frames.run(nowMs); });
}

describe('S8-14 — the due-idea screen over the Scouting Board (ruling R-S8F-5)', () => {
  it("the board's sheet is inert under the screen and under the ceremony after it; each overlay's own root is not", async () => {
    h.due = DUE;
    stackProbe.current.open('legacy:scouting', { opener: hold(), within: shell() });
    board.open();
    await flush();
    const boardDeploy = button('Deploy this agent');
    const boardPortal = bodyChild(boardDeploy);
    expect(boardPortal).not.toBeNull();
    expect(boardPortal).not.toBe(container);
    expect(inert(container)).toBe(true); // the stack's own mark for the board
    expect(inert(boardPortal)).toBe(false);

    await act(async () => { boardDeploy.focus(); boardDeploy.click(); });
    await flush();
    act(() => { frames.run(nowMs); });
    expect(dueRoot()).not.toBeNull();
    // The screen's root alone stays interactive: the board beneath — its Close one Shift+Tab away before — is inert.
    expect(inert(dueRoot())).toBe(false);
    expect(inert(boardPortal)).toBe(true);
    expect(inert(container)).toBe(true);
    expect(boardPortal.contains(document.activeElement)).toBe(false);

    // "Deploy without it": the screen gives way to the ceremony in one sequence. The kept root moves with it.
    await act(async () => { button('Deploy without it').click(); });
    await flush();
    expect(dueRoot()).toBeNull();
    expect(ceremonyRoot()).not.toBeNull();
    expect(inert(ceremonyRoot())).toBe(false);
    expect(inert(boardPortal)).toBe(true);
    expect(inert(container)).toBe(true);

    await refuseAndSettle();
    await act(async () => { button('Back to hub').click(); });
    await flush();
    // The ceremony gone, the board still open: its sheet is interactive again, and the app root stays inert under it.
    expect(ceremonyRoot()).toBeNull();
    expect(inert(boardPortal)).toBe(false);
    expect(inert(container)).toBe(true);
    board.close();
    act(() => { stackProbe.current.close('legacy:scouting', { fallback: shell() }); });
    await flush();
    expect(inertChildren()).toEqual([]);
  });
});

describe('S8-15 — where focus goes when the root ceremony closes (ruling R-S8F-5)', () => {
  it('nothing beneath: the inert goes first, then focus returns to the control the sequence was opened from', async () => {
    await tapFrom(hold());
    expect(ceremonyRoot()).not.toBeNull();
    expect(inert(container)).toBe(true);
    await refuseAndSettle();
    await act(async () => { button('Back to hub').click(); });
    await flush();
    expect(inertChildren()).toEqual([]);
    expect(document.activeElement).toBe(hold());
  });

  it('the control disabled by the time it closes (a refusal that names its wait): focus lands on the hub\'s shell, not on <body>', async () => {
    await tapFrom(hold());
    await refuseAndSettle(LIMITER_429());
    await act(async () => { button('Back to hub').click(); });
    await flush();
    expect(hold().disabled).toBe(true);
    expect(inertChildren()).toEqual([]);
    expect(document.activeElement).toBe(shell());
  });

  it('the control gone by then: the hub\'s shell', async () => {
    const control = document.createElement('button');
    control.type = 'button';
    shell().appendChild(control);
    await tapFrom(control);
    await refuseAndSettle();
    control.remove();
    await act(async () => { button('Back to hub').click(); });
    await flush();
    expect(document.activeElement).toBe(shell());
  });

  it('through the due screen → ceremony swap: focus is not handed back between the two, and returns once at the end', async () => {
    h.due = DUE;
    await tapFrom(hold());
    expect(dueRoot()).not.toBeNull();
    const focused = [];
    const onFocus = (event) => { focused.push(event.target); };
    document.addEventListener('focusin', onFocus);
    try {
      await act(async () => { button('Deploy without it').click(); });
      await flush();
      expect(ceremonyRoot()).not.toBeNull();
      expect(focused).not.toContain(hold());
      expect(focused).not.toContain(shell());
      act(() => { frames.run(nowMs); });
      await refuseAndSettle();
      await act(async () => { button('Back to hub').click(); });
      await flush();
      expect(document.activeElement).toBe(hold());
      expect(focused.filter((el) => el === hold())).toHaveLength(1);
    } finally {
      document.removeEventListener('focusin', onFocus);
    }
  });

  it('the due screen alone (a dismissal, no ceremony): the same return', async () => {
    h.due = DUE;
    await tapFrom(hold());
    expect(dueRoot()).not.toBeNull();
    // An identity change closes the screen without a deploy: the sequence ends there.
    signIn('uid-B');
    await flush();
    expect(dueRoot()).toBeNull();
    expect(inertChildren()).toEqual([]);
    expect(posts).toHaveLength(0);
    expect(document.activeElement).toBe(hold());
  });
});

// The S8 review's K-5 (its lens Q3's 6 × 2 rows, gone with its snapshot, rebuilt here): every hub sheet beneath the
// provider's overlays, in both closing orders. History and Activity are the hub's own HubSheet, registered by their root
// (`keep`); the record, archetype, watchlist and Scouting Board sheets are the shipped ones, registered within the hub.
// Each stand-in sheet is a portal into <body> with a Close button, as theirs are.
const SHEETS = [
  ['history', 'keep'], ['activity', 'keep'],
  ['record', 'within'], ['archetype', 'within'], ['watchlist', 'within'], ['scouting', 'within'],
];

function openStandInSheet(kind, how) {
  const portal = document.createElement('div');
  portal.setAttribute('data-stand-in-sheet', kind);
  portal.innerHTML = '<div role="dialog" aria-modal="true"><button type="button">Close</button></div>';
  document.body.appendChild(portal);
  const id = how === 'keep' ? kind : `legacy:${kind}`;
  act(() => { stackProbe.current.open(id, how === 'keep' ? { opener: hold(), keep: portal } : { opener: hold(), within: shell() }); });
  return {
    portal,
    close: () => { act(() => { stackProbe.current.close(id, { fallback: shell() }); }); portal.remove(); },
  };
}

describe('K-5 rebuilt — each hub sheet beneath the due screen and the ceremony, in both closing orders (ruling R-S8F-5)', () => {
  it.each(SHEETS.flatMap(([kind, how]) => [[kind, how, 'the ceremony first'], [kind, how, 'the sheet first']]))(
    '%s (%s): %s',
    async (kind, how, order) => {
      h.due = DUE;
      const sheet = openStandInSheet(kind, how);
      expect(inert(container)).toBe(true);
      // The hub's controls sit under the sheet's own inert: the tap is the provider's, as the board's footer makes it.
      await tapFrom(null, CARD, { exemptOverlay: true });
      expect(dueRoot()).not.toBeNull();
      expect(inert(dueRoot())).toBe(false);
      expect(inert(container)).toBe(true);
      expect(inert(sheet.portal)).toBe(true);

      await act(async () => { button('Deploy without it').click(); });
      await flush();
      expect(inert(ceremonyRoot())).toBe(false);
      expect(inert(container)).toBe(true);
      expect(inert(sheet.portal)).toBe(true);
      await refuseAndSettle();

      if (order === 'the ceremony first') {
        await act(async () => { button('Back to hub').click(); });
        await flush();
        expect(inert(container)).toBe(true); // the sheet still holds it
        expect(inert(sheet.portal)).toBe(false);
        sheet.close();
      } else {
        sheet.close();
        expect(inert(container)).toBe(true); // the ceremony still holds it
        await act(async () => { button('Back to hub').click(); });
        await flush();
      }
      expect(inertChildren()).toEqual([]);
    },
  );
});

// The build's own review, the mutating lens L4: four of its survivors (M10, M16, M17, M30), closed with a row each.
describe('review fixes L4 — what the overlay rows did not pin', () => {
  it('M16: a sequence opened with focus nowhere (<body>) ends on the hub\'s shell, never left on <body>', async () => {
    act(() => { document.activeElement?.blur?.(); });
    expect(document.activeElement).toBe(document.body);
    await tapFrom(null);
    expect(ceremonyRoot()).not.toBeNull();
    await refuseAndSettle();
    await act(async () => { button('Back to hub').click(); });
    await flush();
    expect(document.activeElement).toBe(shell());
  });

  it('M17: an invoker still connected but no longer focusable gives way to the shell (a focus() that did not land is not a restore)', async () => {
    const control = document.createElement('div');
    control.tabIndex = 0;
    shell().appendChild(control);
    await tapFrom(control);
    await refuseAndSettle();
    control.removeAttribute('tabindex');
    await act(async () => { button('Back to hub').click(); });
    await flush();
    expect(control.isConnected).toBe(true);
    expect(document.activeElement).toBe(shell());
  });

  it('M10: the effect is re-keyed at the due screen → ceremony swap: what joined <body> under the due screen is inert under the ceremony', async () => {
    h.due = DUE;
    await tapFrom(hold());
    expect(dueRoot()).not.toBeNull();
    const late = document.createElement('div');
    late.innerHTML = '<button type="button">Late</button>';
    document.body.appendChild(late);
    await act(async () => { button('Deploy without it').click(); });
    await flush();
    expect(ceremonyRoot()).not.toBeNull();
    expect(inert(late)).toBe(true);
    expect(inert(ceremonyRoot())).toBe(false);
    await refuseAndSettle();
    await act(async () => { button('Back to hub').click(); });
    await flush();
    expect(inertChildren()).toEqual([]);
  });

  it('M30: the Scouting Board beneath the due screen takes no key pressed with focus nowhere: Escape leaves it open, Tab is not trapped into it', async () => {
    h.due = DUE;
    stackProbe.current.open('legacy:scouting', { opener: hold(), within: shell() });
    board.open();
    await flush();
    const boardDeploy = button('Deploy this agent');
    await act(async () => { boardDeploy.focus(); boardDeploy.click(); });
    await flush();
    act(() => { frames.run(nowMs); });
    expect(dueRoot()).not.toBeNull();
    expect(inert(bodyChild(boardDeploy))).toBe(true);
    act(() => { document.activeElement?.blur?.(); });
    expect(document.activeElement).toBe(document.body);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => { document.body.dispatchEvent(escape); });
    expect(boardCloses).toBe(0);
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => { document.body.dispatchEvent(tab); });
    expect(tab.defaultPrevented).toBe(false);
    expect(bodyChild(boardDeploy).contains(document.activeElement)).toBe(false);
  });
});

// Founder ruling Q-S8F-1 (the build's review, L2-1): a Scouting Board deploy that answers "created" closes the board
// while the ceremony is up, so the stack's own restore cannot land (the page is inert). On "Back to hub" focus goes to
// the opener the stack still owes — "See what it's eyeing" — when it is still there and enabled, before the shell.
describe('founder ruling Q-S8F-1 — the opener the hub\'s stack still owes', () => {
  const CREATED = () => ({ outcome: 'created', success: true, agentBattleId: 'battle-new' });
  const boardOpener = () => document.querySelector('[data-board-opener]');
  // framer-motion's exits never finish under jsdom's stubbed frames: skip the animations, as a finished exit.
  beforeEach(() => { MotionGlobalConfig.skipAnimations = true; });
  afterEach(() => { MotionGlobalConfig.skipAnimations = false; });

  async function deployFromTheBoard() {
    act(() => { boardOpener().focus(); });
    act(() => { stackProbe.current.open('legacy:scouting', { opener: boardOpener(), within: shell() }); });
    board.open();
    await flush();
    const boardDeploy = button('Deploy this agent');
    await act(async () => { boardDeploy.focus(); boardDeploy.click(); });
    await flush();
    act(() => { frames.run(nowMs); });
    expect(ceremonyRoot()).not.toBeNull();
    await act(async () => { posts[0].answer(CREATED()); });
    await flush();
    await flush();
    // The board closed itself under the ceremony; its opener could not take focus then.
    expect(boardCloses).toBe(1);
    expect(document.activeElement).not.toBe(boardOpener());
    // Its exit (instant here: animations are skipped in this describe; under a second in a browser) took its footer —
    // the captured invoker — out of the document.
    expect(button('Deploy this agent')).toBeUndefined();
  }

  it('"created" from the board, then Back to hub: focus returns to "See what it\'s eyeing", not to the shell', async () => {
    await deployFromTheBoard();
    await act(async () => { button('Back to hub').click(); });
    await flush();
    expect(ceremonyRoot()).toBeNull();
    expect(inertChildren()).toEqual([]);
    expect(document.activeElement).toBe(boardOpener());
  });

  it('the opener disabled by then: the shell', async () => {
    await deployFromTheBoard();
    boardOpener().disabled = true;
    await act(async () => { button('Back to hub').click(); });
    await flush();
    expect(document.activeElement).toBe(shell());
  });

  it('an opener owed from before the sequence is not this sequence\'s: a later ceremony whose invoker is disabled ends on the shell', async () => {
    // A sheet closed while the page was inert for another reason leaves its opener owed.
    act(() => { stackProbe.current.open('legacy:record', { opener: boardOpener(), within: shell() }); });
    expect(inert(container)).toBe(true);
    container.setAttribute('inert', '');
    act(() => { stackProbe.current.close('legacy:record', { fallback: shell() }); });
    container.removeAttribute('inert');
    await tapFrom(hold());
    await refuseAndSettle(LIMITER_429());
    await act(async () => { button('Back to hub').click(); });
    await flush();
    expect(hold().disabled).toBe(true);
    expect(document.activeElement).toBe(shell());
  });
});
