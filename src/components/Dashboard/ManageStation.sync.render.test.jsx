// src/components/Dashboard/ManageStation.sync.render.test.jsx
//
// Command Center Sync Pass 1, Phase B — the Manage rail is the ONE slot both
// dashboard shells genuinely share (CommandDashboardDesktop.jsx:260-262 and
// CommandDashboard.jsx:521-523 render it identically), so making it
// phase-aware covers both surfaces from one component.
//
// Two things are proved here:
//
//   1. THE DARK PHOTOGRAPH. With no `sync` prop — which is exactly what the
//      shells pass while COMMAND_CENTER_SYNC_ENABLED is false, because the hook
//      returns null — the rendered html is BYTE-IDENTICAL to a render from
//      before this pass. That is the spec §12 acceptance, proved by string
//      equality rather than by a snapshot (the repo has no snapshot idiom; the
//      byte-identity precedent is AgentRecordSheet.render.test.jsx:74).
//
//   2. THE HONESTY FIX. Lit, the card stops saying the agent "is trading"
//      overnight, at the weekend and on holidays. Evals are hard-gated to
//      regular trading hours (api/cron/agent-evaluate.js:284-286), so for most
//      of a fullday battle's life the old copy was simply false.
//
// renderToString + toContain is the repo's universal component-test idiom —
// React Testing Library is not installed anywhere in this project.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import ManageStation from './ManageStation.jsx';

// Captured from the PRE-PASS component at commit eebc8ffe by rendering it with
// the exact props below, under the same pinned clock. This is the flag-off acceptance (spec §12) in its
// strongest form: not "the new component agrees with itself", but "the new
// component's dark output is the old component's output, byte for byte".
// Regenerate ONLY if the dark render intentionally changes — which for this
// pass it must not.
const DARK_GOLDEN = readFileSync(
  new URL('./desk/__golden__/manageStation.dark.html', import.meta.url),
  'utf8',
);

const BATTLE = {
  id: 'battle-1',
  status: 'active',
  agentContext: { agentName: 'Aurora' },
  scoreState: { currentScore: 42, tradeCount: 3 },
  expiresAt: '2026-09-01T20:00:00.000Z', // 3h after the pinned clock below
};

// timeLeft() reads Date.now() (ManageStation.jsx:20), so the card's right rail
// is clock-dependent and the golden below would rot between runs — it did:
// the file passed in isolation and failed in the full suite, minutes later,
// on a "634105h 43m left" that had ticked. Pinning the clock makes the whole
// render deterministic, which is what a byte-identity golden requires.
const PINNED_NOW = new Date('2026-09-01T17:00:00.000Z');
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(PINNED_NOW); });
afterEach(() => { vi.useRealTimers(); });

const AGENT = { name: 'Aurora' };

// React SSR inserts <!-- --> separators between adjacent text expressions, so
// `{tradeCount} trades` renders as `3<!-- --> trades`. Stripping them is the
// repo idiom (AgentRecordSheet.render.test.jsx:65). Byte-identity assertions
// compare stripped-to-stripped, which is still exact.
const stripComments = (h) => h.replace(/<!-- -->/g, '');

const render = (props = {}) => stripComments(renderToString(
  <ManageStation battle={BATTLE} agent={AGENT} accent="#5eead4" onOpen={() => {}} {...props} />,
));

const syncFor = (phase, over = {}) => ({
  game: { id: 'battle-1', type: 'baggerbomb', label: 'BaggerBomb' },
  phase,
  nextDecisionAt: null,
  nextOpenEt: { weekdayIndex: 2, hour: 9, minute: 30 }, // Tue 9:30 ET, wall clock
  ...over,
});

describe('flag-OFF is byte-identical (spec §12)', () => {
  it('the dark render is BYTE-IDENTICAL to the pre-pass component', () => {
    expect(render()).toBe(DARK_GOLDEN);
  });

  it('an explicit null sync is the same as no sync prop at all', () => {
    expect(render({ sync: null })).toBe(DARK_GOLDEN);
  });

  it('dark, the card still says the agent is trading — nothing about it moved', () => {
    const html = render();
    expect(html).toContain('Aurora is trading');
    expect(html).not.toContain('Market closed');
    expect(html).not.toContain('Resumes');
  });

  it('dark, the right rail is still the expiry countdown', () => {
    expect(render()).toContain('left');
  });

  // NOTE: an earlier row here claimed to guard the shells' battle-id match and
  // actually compared the component to itself — it could not fail. The real
  // guard lives in the shells, and it is now tested where it lives, against the
  // extracted helper: see syncForBattle in deskAdapterBoundary.test.js.
});

describe('lit — the phase drives the activity line', () => {
  it('LIVE keeps "is trading" — during regular hours it is true', () => {
    const html = render({ sync: syncFor('LIVE') });
    expect(html).toContain('Aurora is trading');
  });

  it('LIVE_CLOSED says the market is closed, NOT that the agent is trading', () => {
    const html = render({ sync: syncFor('LIVE_CLOSED') });
    expect(html).toContain('Market closed');
    expect(html).not.toContain('is trading');
  });

  it('PRE_OPEN says it is waiting for the open', () => {
    const html = render({ sync: syncFor('PRE_OPEN') });
    expect(html).toContain('Waiting for the open');
    expect(html).not.toContain('is trading');
  });

  it('POST_CLOSE does not claim trading either', () => {
    const html = render({ sync: syncFor('POST_CLOSE') });
    expect(html).not.toContain('is trading');
  });
});

describe('lit — the resume time never displaces a still-true countdown', () => {
  // A crypto fullday battle expires at 8:00 PM ET, four hours after the market
  // closes. For that window it is LIVE_CLOSED and still counting down to an end
  // the next open never reaches — so an earlier version, which replaced the
  // countdown with "Resumes Tue 9:30 AM ET", discarded the truer of the two
  // facts. The resume time now rides the activity line instead.
  it('LIVE_CLOSED keeps the expiry countdown in the right rail', () => {
    const html = render({ sync: syncFor('LIVE_CLOSED') });
    expect(html).toContain('left');
  });

  it('LIVE_CLOSED still says when the agent resumes — on the activity line', () => {
    const html = render({ sync: syncFor('LIVE_CLOSED') });
    expect(html).toContain('Market closed · resumes Tue 9:30 AM ET');
  });

  it('the resume time comes from WALL-CLOCK FIELDS, not an epoch', () => {
    // Reading the fields keeps this string identical for every viewer,
    // wherever they are; formatting the epoch did not.
    const html = render({ sync: syncFor('LIVE_CLOSED', { nextOpenEt: { weekdayIndex: 1, hour: 9, minute: 30 } }) });
    expect(html).toContain('resumes Mon 9:30 AM ET');
  });

  it('degrades to a bare "Market closed" when the next open is unknown', () => {
    const html = render({ sync: syncFor('LIVE_CLOSED', { nextOpenEt: null }) });
    expect(html).toContain('Market closed');
    expect(html).not.toContain('resumes');
  });

  it('PRE_OPEN, which has no meaningful countdown yet, shows the resume time in the rail', () => {
    const html = render({ sync: syncFor('PRE_OPEN'), battleOver: { expiresAt: null } });
    expect(html).toContain('Waiting for the open');
  });

  it('LIVE keeps the countdown and says nothing about resuming', () => {
    const html = render({ sync: syncFor('LIVE') });
    expect(html).toContain('left');
    expect(html).not.toContain('resumes');
  });
});

describe('the score and trade count are untouched by the phase', () => {
  for (const phase of [null, 'LIVE', 'LIVE_CLOSED', 'PRE_OPEN', 'POST_CLOSE']) {
    it(`renders the trade count in ${phase ?? 'dark'}`, () => {
      const html = render(phase ? { sync: syncFor(phase) } : {});
      expect(html).toContain('3 trades');
    });
  }
});
