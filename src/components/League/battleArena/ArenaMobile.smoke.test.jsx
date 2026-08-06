// src/components/League/battleArena/ArenaMobile.smoke.test.jsx
//
// Render smoke for the mobile arena. As with ArenaDesktop.smoke, the repo ships no
// jsdom/RTL — react-dom/server renders the full tree WITHOUT a DOM (effects don't
// run, so ResizeObserver / rAF / matchMedia are never touched), enough to catch a
// runtime throw on mount that build + lint cannot.
//
// The full-tree render only reaches the DEFAULT 'you' tab (renderToString fires no
// clicks/effects), so the agent + chat surfaces — MAgentPanel and the chat AgentDock
// — are covered by mounting them DIRECTLY below. Together these exercise the prop
// wiring the design mock got wrong (ArenaTopStrip pod / ClimbArena seats+climb /
// AgentDock live+archName+ask+onAsk) — a missing data prop throws here.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ArenaMobile, MAgentPanel } from './ArenaMobile';
import { AgentDock } from './CommandDock';

describe('ArenaMobile render smoke', () => {
  for (const state of ['awaiting', 'live', 'complete']) {
    for (const mode of ['training', 'ranked']) {
      it(`mounts in ${state} / ${mode} without throwing`, () => {
        const html = renderToString(<ArenaMobile state={state} mode={mode} />);
        if (state === 'complete') {
          expect(html).toContain('Film Room');     // the verdict + seal-break composed
        } else {
          expect(html).toContain('Your Portfolio'); // the tab bar composed
          expect(html).toContain('Your three');     // the default (you) panel composed
        }
        expect(html.length).toBeGreaterThan(2000);   // real surface, not an early bail
      });
    }
  }

  // the real-data path (data != null) must also compose (still no DOM). Mirrors the
  // buildArenaModel output shape, same as ArenaDesktop.smoke's DATA.
  const DATA = {
    seats: [
      { id: 'you', name: 'You', kind: 'you', you: true, color: '#5EEAD4', arch: 'Speculator' },
      { id: 'cpu-1', name: 'CPU — Trend Follower', kind: 'cpu', you: false, arch: undefined },
      { id: 'r', name: 'Riva', kind: 'human', you: false, owner: 'Riva', arch: undefined },
      { id: 'cpu-2', name: 'CPU — Contrarian', kind: 'cpu', you: false, arch: undefined },
    ],
    climb: { you: [-1.2, 1.4], 'cpu-1': [2.1, 3.0], r: [3.2, 5.8], 'cpu-2': [0.4, -0.8] },
    youId: 'you',
    agentStars: [{ tk: 'NVDA', tier: 'star', dir: 'long', mult: 0.7, banked: 0, points: 0, badge: null, state: 'heating', justIn: false }],
    userStars: [{ tk: 'GE', tier: 'support', dir: 'long', mult: 0.6, banked: 0, points: 0, badge: null, state: 'heating', justIn: false }],
    beats: [],
    voice: { arch: 'Speculator', greet: { kind: 'greeting', text: 'hi' }, wait: { kind: 'anticipation', text: 'wait' }, live: [] },
    pod: { day: 2, days: 5, watchers: 47, toOpen: null, nextClose: null },
    wire: { open: true, closes: 600, claimsUsed: 0, claimsTotal: 3 },
    youRank: 3, headline: 'mult', compositeContext: { composite: 1.4, userPoints: 0.5 },
    claim: { picks: [{ symbol: 'GE' }], poolNames: ['NVDA'], claimsUsed: 0, claimsTotal: 3, open: true },
    agentMove: null, ask: [],
  };
  const handlers = { onFlip: async () => {}, onClaim: async () => {}, onAsk: async () => {} };

  it('composes the data-fed (real) path without throwing', () => {
    const html = renderToString(<ArenaMobile state="live" mode="ranked" data={DATA} handlers={handlers} />);
    expect(html).toContain('Your Portfolio'); // the tab bar
    expect(html).toContain('GE');             // a real user star rendered (default you tab)
    expect(html.length).toBeGreaterThan(2000);
  });

  // L-A follow-up (B) — the mobile twin of the desktop suppression: a VOIDED cohort
  // shows no placement (MComplete) and no cut/standings on the hero board, stating
  // the void; Film Room stays (review only). Mutation-checked against the same
  // spread-score DATA rendered WITHOUT voided.
  it('a VOIDED complete run shows no placement/standings and states the void', () => {
    const html = renderToString(<ArenaMobile state="complete" mode="ranked" data={DATA} voided />);
    expect(html).not.toContain('of four');
    expect(html).not.toContain('You advanced');
    expect(html).not.toContain('Run ended');
    expect(html).not.toContain('TOP 2 ADVANCE');
    expect(html).toContain('No result recorded');
    expect(html).toContain('Film Room');
    expect(html.length).toBeGreaterThan(2000);
  });

  it('the SAME complete run WITHOUT voided DOES show placement + cut (suppression is real)', () => {
    const html = renderToString(<ArenaMobile state="complete" mode="ranked" data={DATA} />);
    expect(html).toContain('of four');
    expect(html).toContain('TOP 2 ADVANCE');
  });

  // The Agent-Portfolio tab is behind tab state renderToString can't switch to, so
  // mount MAgentPanel directly — covers the agent-six + swap-flare wiring.
  it('MAgentPanel composes (agent six + move chip + flare) without throwing', () => {
    const html = renderToString(
      <MAgentPanel stars={DATA.agentStars} move={DATA.agentMove} calm={false} done={false} headline="mult" cellBump={() => 0} flareKey={1} />,
    );
    expect(html).toContain('watch-only'); // the agent panel composed
    expect(html).toContain('NVDA');        // the agent star rendered
  });

  // The chat tab renders AgentDock with the exact mobile wiring (the mock's call was
  // wrong) — mount it directly with those props.
  it('AgentDock (mobile chat wiring) composes without throwing', () => {
    const html = renderToString(
      <AgentDock compact live lines={[{ kind: 'read', text: 'holding the line', _k: 1 }]} archName="Speculator" ask={[{ q: 'why?', a: 'because' }]} onAsk={() => {}} />,
    );
    expect(html).toContain('Speculator'); // archName wired (not the mock's missing prop)
    expect(html).toContain('Ask your agent');
  });

  // The two-way ask (chatReady) render: the real input + "N left today" counter + the
  // strategy chips. Proves the flag-on path composes (the flag itself is read upstream
  // in useArenaEngine → chatReady; here we drive AgentDock directly).
  it('AgentDock (two-way ask, chatReady) renders the input + counter without throwing', () => {
    const html = renderToString(
      <AgentDock
        compact live lines={[{ kind: 'read', text: 'live', _k: 1 }]} archName="Speculator"
        ask={[{ q: 'What is the plan from here?' }, { q: 'How do we protect the lead?' }]}
        onAsk={() => {}} askLive={() => {}} remaining={7} asking={false} chatReady
      />,
    );
    expect(html).toContain('left today');              // the persistent counter rendered
    expect(html).toContain('How do we protect the lead?'); // a strategy chip rendered
    expect(html).toContain('Ask anything…');           // the real free-text input placeholder
  });
});
