// src/components/Agent/regimeLabels.render.test.jsx
//
// ONE REGIME VOCABULARY, THREE SURFACES (BUILD_RULES §9).
//
// `AgentActivityFeed.jsx` and `StatusFeedTimeline.jsx` each declared their own
// `REGIME_LABELS` with the same four pairs, and the Why? panel declared none
// and printed the raw token — three surfaces, one vocabulary, no single place
// to change it. Both feeds now read `REGIME_LABELS` from `decisionRecord.js`.
//
// THE RE-POINT IS A NO-OP AND THESE ROWS ARE THE PROOF. The map each file used
// to declare is frozen below verbatim; every row renders the real component
// against it, so a shared map that ever stops agreeing with the shipped words
// fails here rather than silently repainting two live feeds.
//
// The import IS the dependency guard (BUILD_RULES §4): decisionRecord.js is
// zero-import, and this file explodes in the Node test env if that changes.
// Never mocked.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

// GameplanMeetingCard (an AgentActivityFeed child) reaches firebase through
// agentService; the feed under test never calls it.
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('../../services/agentService', () => ({
  resolveGameplanMeeting: vi.fn(), appendBattleLedger: vi.fn(),
}));

import AgentActivityFeed from './AgentActivityFeed';
import StatusFeedTimeline from './StatusFeedTimeline';
import { REGIME_LABELS, REGIME_WORDS, regimeLabel } from '../../data/decisionRecord';

// Of the two feeds only AgentActivityFeed is on a live path (AgentBattleScreen
// → PaneTape / GameTapeView). StatusFeedTimeline is reached only from
// AgentStrategyTab.ARCHIVED.jsx, which nothing imports — its rows below pin a
// dead file, and are kept so the two stay identical if it is ever revived.

/** The literal both files declared before the re-point. Byte for byte. */
const SHIPPED_REGIME_LABELS = {
  directional_expansion: 'Expanding',
  directional_contraction: 'Contracting',
  choppy: 'Choppy',
  distressed: 'Distressed',
};

const TOKENS = {
  teal: '#5eead4', amber: '#fbbf24', emerald: '#34d399', red: '#ef4444',
  textWhite: '#ffffff', textSecondary: '#cbd5e1', textMuted: '#94a3b8', textFaint: '#64748b',
};
// `swap` is a HIGH-tier action in both feeds, so the entry renders as its own
// card with the pill row rather than folding into a collapsed group.
const entry = (regime) => ({
  evalId: 'e-1', timestamp: '2026-09-01T16:45:00.000Z',
  action: 'swap', symbolOut: 'CRM', symbolIn: 'DVN', message: 'Swapped CRM for DVN.', regime,
});
const strip = (h) => h.replace(/<!-- -->/g, '');

// THE PROTOTYPE KEYS ARE THE POINT (review C-5). Both feeds used to gate on a
// bare `REGIME_LABELS[entry.regime]`, which is truthy for every
// Object.prototype key: `regime: 'constructor'` resolved the label to a
// FUNCTION and threw inside `hexToRgba` before any colour fallback could fire.
// Gating on `regimeLabel` tests the closed list instead, so the feeds and the
// Why? panel agree on which tokens are ruled. `risk_on` alone never proved
// that — it is unruled AND absent from the prototype.
const UNRULED = ['risk_on', 'constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'];

describe('the shared map IS the shipped map', () => {
  it('four pairs, the same four words, in the same order', () => {
    expect(REGIME_LABELS).toEqual(SHIPPED_REGIME_LABELS);
    expect(REGIME_WORDS).toEqual(Object.keys(SHIPPED_REGIME_LABELS));
  });

  // The closed list is DERIVED from the labels, so a token without a word (or
  // a word without a token) is not a state this module can be left in.
  it('every ruled token has a word, and an unruled one has none', () => {
    for (const token of REGIME_WORDS) expect(regimeLabel(token)).toBe(SHIPPED_REGIME_LABELS[token]);
    for (const bad of ['risk_on', 'trending', '', null, undefined, 42]) {
      expect(regimeLabel(bad)).toBeNull();
    }
  });
});

describe('AgentActivityFeed — byte-identical after the re-point', () => {
  const render = (regime) => strip(renderToString(
    <AgentActivityFeed statusFeed={[entry(regime)]} tokens={TOKENS} />
  ));

  it('renders the shipped word for every token, and never the token itself', () => {
    for (const [token, word] of Object.entries(SHIPPED_REGIME_LABELS)) {
      const html = render(token);
      expect(html).toContain(`>${word}<`);
      expect(html).not.toContain(token);
    }
  });

  it('an unruled token renders no regime pill — INCLUDING a prototype key', () => {
    for (const unruled of UNRULED) {
      const html = render(unruled);
      expect(html).not.toContain(unruled);
      for (const word of Object.values(SHIPPED_REGIME_LABELS)) expect(html).not.toContain(`>${word}<`);
    }
  });
});

describe('StatusFeedTimeline — byte-identical after the re-point', () => {
  const render = (regime) => strip(renderToString(
    <StatusFeedTimeline statusFeed={[entry(regime)]} tokens={TOKENS} />
  ));

  it('renders the shipped word for every token, and never the token itself', () => {
    for (const [token, word] of Object.entries(SHIPPED_REGIME_LABELS)) {
      const html = render(token);
      expect(html).toContain(`>${word}<`);
      expect(html).not.toContain(token);
    }
  });

  it('an unruled token renders no regime pill — INCLUDING a prototype key', () => {
    for (const unruled of UNRULED) {
      const html = render(unruled);
      expect(html).not.toContain(unruled);
      for (const word of Object.values(SHIPPED_REGIME_LABELS)) expect(html).not.toContain(`>${word}<`);
    }
  });
});
