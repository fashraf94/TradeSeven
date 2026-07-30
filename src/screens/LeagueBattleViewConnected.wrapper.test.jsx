// @vitest-environment jsdom
//
// src/screens/LeagueBattleViewConnected.wrapper.test.jsx
//
// Regression tests for the two HIGH-severity /code-review fixes on the League
// routing wrapper. The wrapper is stateful (subscription-driven), so this file
// opts into jsdom + React.act (the repo default is node/renderToString, which
// never runs effects). The firebase-touching data sources are mocked out, and the
// render split is stubbed so we can read which group/mode/battle it received.
//
//   #1  resolved-null group → the honest "not live" card, NOT an endless spinner
//       and NOT the Arena. (RED under the old `!loaded || (uid && !group)` guard.)
//   #2/#3/#5  the wrapper subscribes via subscribeGroup with the TAPPED battle's
//       groupId (never subscribeMyGroup-by-membership), so it renders the tapped
//       game and derives mode from the resolved pod. (RED under by-membership.)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const H = vi.hoisted(() => {
  const state = { captured: null, battle: { id: 'battle-1' } };
  return {
    state,
    subscribeGroup: vi.fn((groupId, cb) => { state.captured = { groupId, cb }; return () => {}; }),
    subscribeMyGroup: vi.fn(() => () => {}),
    useMyTournamentBattle: vi.fn(() => ({ battle: state.battle })),
  };
});

vi.mock('../services/tournamentGroupService', () => ({
  subscribeGroup: H.subscribeGroup,
  subscribeMyGroup: H.subscribeMyGroup,
}));
vi.mock('../hooks/useMyTournamentBattle', () => ({ default: H.useMyTournamentBattle }));
vi.mock('../contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => ({ isDesktop: true }) }));
vi.mock('./leagueBattleViewRender', () => ({
  default: ({ group, mode, battle }) =>
    React.createElement('div', null, `RENDER group=${group?.id} mode=${mode} battle=${battle?.id}`),
}));

import LeagueBattleViewConnected from './LeagueBattleViewConnected';

let container;
let root;
function mount(props) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(React.createElement(LeagueBattleViewConnected, props)); });
}
function resolve(group) {
  act(() => { H.state.captured.cb(group); });
}

beforeEach(() => {
  H.subscribeGroup.mockClear();
  H.subscribeMyGroup.mockClear();
  H.state.captured = null;
  H.state.battle = { id: 'battle-1' };
});
afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe('LeagueBattleViewConnected — wrapper behavior (code-review High fixes)', () => {
  it('#1 resolved-null group renders the not-live card, not a spinner and not the Arena', () => {
    mount({ groupId: 'g-ranked', onBack: () => {} });
    // Before the snapshot fires, it is loading.
    expect(container.textContent).toContain('Loading the arena');
    // Subscription resolves with NO group (distinct from still-loading).
    resolve(null);
    const text = container.textContent;
    expect(text).toContain('live right now');          // the honest not-live card
    expect(text).not.toContain('Loading the arena');   // NOT an endless spinner
    expect(text).not.toContain('RENDER');              // NOT the Arena/render split
  });

  it('#2/#3/#5 subscribes via subscribeGroup with the tapped groupId (never subscribeMyGroup), rendering the tapped game', () => {
    mount({ groupId: 'g-ranked', onBack: () => {} });
    expect(H.subscribeGroup).toHaveBeenCalledWith('g-ranked', expect.any(Function));
    expect(H.subscribeMyGroup).not.toHaveBeenCalled();
    // A user who also holds a training pod tapped the RANKED game → the ranked
    // group resolves and drives the render, never a sibling.
    resolve({ id: 'g-ranked', isTraining: false });
    const text = container.textContent;
    expect(text).toContain('group=g-ranked');
    expect(text).toContain('mode=ranked');
    expect(text).toContain('battle=battle-1');
  });

  it('#2 derives mode=training when the tapped game resolves to a training pod (D1c)', () => {
    mount({ groupId: 'g-training', onBack: () => {} });
    expect(H.subscribeGroup).toHaveBeenCalledWith('g-training', expect.any(Function));
    resolve({ id: 'g-training', isTraining: true });
    expect(container.textContent).toContain('mode=training');
  });
});
