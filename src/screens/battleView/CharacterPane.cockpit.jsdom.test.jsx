// @vitest-environment jsdom
//
// src/screens/battleView/CharacterPane.cockpit.jsdom.test.jsx
//
// Cockpit Build 2a (spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md §5) — the pane's
// segmented control at the component: "Chat · {n}" only while ANOTHER section
// shows. The screen marks the chat seen the moment Chat shows, so it never
// hands the pane a count with Chat up and the screen's own rows cannot tell
// the two rules apart; this file holds the component's half (mutation battery
// C39, docs/audits/20261003_BUILD2A_COCKPIT_SCREEN.md).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PANE_SECTION, PANE_SECTIONS, COCKPIT_PANE_SECTIONS } from './useCharacterPane';

vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isAgentPresenceOn: () => false,
}));

const CharacterPane = (await import('./CharacterPane.jsx')).default;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const BATTLE = {
  agentContext: { agentName: 'Aurora', archetype: 'degen' },
  scoreState: { currentScore: 12, opponentScore: 3 },
};
const renderPane = (props) => act(() => {
  root.render(
    <CharacterPane
      agentBattle={BATTLE}
      open
      isDesktop
      sections={COCKPIT_PANE_SECTIONS}
      section={PANE_SECTION.COCKPIT}
      onSelectSection={() => {}}
      onClose={() => {}}
      cockpit={<div data-test-cockpit="1" />}
      chat={<div data-test-chat="1" />}
      bench={<div data-test-bench="1" />}
      tape={<div data-test-tape="1" />}
      {...props}
    />,
  );
});
const chatTab = () => container.querySelector('[data-pane-tab="chat"]').textContent;

describe('the Chat tab\'s count (§5)', () => {
  it('counts while Cockpit, Bench or Tape shows', () => {
    for (const section of [PANE_SECTION.COCKPIT, PANE_SECTION.BENCH, PANE_SECTION.TAPE]) {
      renderPane({ section, chatUnread: 3 });
      expect(chatTab()).toBe('Chat · 3');
    }
  });

  it('reads plain "Chat" while Chat itself shows, whatever count it is handed (mutation battery C39)', () => {
    renderPane({ section: PANE_SECTION.CHAT, chatUnread: 3 });
    expect(chatTab()).toBe('Chat');
  });

  it('reads plain "Chat" at a zero count, and on the shipped list', () => {
    renderPane({ section: PANE_SECTION.COCKPIT, chatUnread: 0 });
    expect(chatTab()).toBe('Chat');
    renderPane({ sections: PANE_SECTIONS, section: PANE_SECTION.BENCH });
    expect(chatTab()).toBe('Chat');
  });
});
