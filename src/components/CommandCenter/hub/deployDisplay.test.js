// src/components/CommandCenter/hub/deployDisplay.test.js
//
// Command Center hub, slice S1 — the strip's and the Deploy card's state
// table (spec V1.2 §3.1, §5.2, §10; the design's GameStrip / DeploySection).
// S1 renders `checking`; the other rows are the design's states, reached only
// from fixtures until S2a/S2b. The table translates; it never decides.

import { describe, expect, it } from 'vitest';
import { DEPLOY_DISPLAY_STATES, deployDisplay } from './deployDisplay';
import { HUB_COPY as COPY } from './hubCopy';

const LOADOUT = 'Speculator · High-Beta Ten';
const LIVE = { clock: '2h 41m left' };
const PRE_OPEN = { clock: 'opens 9:30 AM ET', preOpen: true };

describe('the vocabulary (spec §5.2 — display words, never stored phases)', () => {
  it('renders exactly the design\'s six states, in the §3.1 vocabulary', () => {
    expect(DEPLOY_DISPLAY_STATES).toEqual(['checking', 'ready', 'blocked', 'eligibility_error', 'submitting', 'confirmed']);
  });

  it('no provider phase is a display key: idle, created, existing, refused, uncertain and orphaned are stored phases', () => {
    for (const phase of ['idle', 'created', 'existing', 'refused', 'uncertain', 'orphaned']) {
      expect(DEPLOY_DISPLAY_STATES).not.toContain(phase);
      expect(Object.keys(COPY.deploy.states)).not.toContain(phase);
    }
  });

  it('every state has its words in hubCopy, and the copy table holds no other state', () => {
    expect(Object.keys(COPY.deploy.states).sort()).toEqual([...DEPLOY_DISPLAY_STATES].sort());
  });

  it.each([undefined, null, {}, { displayState: 'created' }, { displayState: 'refused', canStart: true }, { displayState: 'READY', canStart: true }])(
    'an unknown or stored-phase input (%j) fails closed to checking, with nothing able to start',
    (deploy) => {
      const d = deployDisplay(deploy);
      expect(d.displayState).toBe('checking');
      expect(d.canStart).toBe(false);
      expect(d.status).toBe(COPY.deploy.states.checking);
    },
  );
});

describe('S1 production: checking eligibility', () => {
  const d = deployDisplay({ displayState: 'checking', canStart: false });
  it('reads "Checking eligibility…" on both surfaces, with the hold present and nothing able to start', () => {
    expect(d.status).toBe('Checking eligibility…');
    expect(d.stripLine1).toBe('Checking eligibility…');
    expect(d.stripLine2(LOADOUT)).toBe(LOADOUT);
    expect(d.strip).toEqual({ openGame: false, hold: { label: COPY.deploy.holdShort, secondary: false }, retry: false });
    expect(d.cardLine).toEqual({ icon: null, text: 'Checking eligibility…', retry: false });
    expect(d.canStart).toBe(false);
    expect(d.processing).toBe(false);
  });
});

describe('the design\'s other states', () => {
  it('ready: "Ready to deploy", the hold, and canStart only when the selector said so', () => {
    expect(deployDisplay({ displayState: 'ready', canStart: true }).canStart).toBe(true);
    expect(deployDisplay({ displayState: 'ready', canStart: false }).canStart).toBe(false);
    expect(deployDisplay({ displayState: 'ready', canStart: 'yes' }).canStart).toBe(false);
    const d = deployDisplay({ displayState: 'ready', canStart: true });
    expect(d.stripLine1).toBe('Ready to deploy');
    expect(d.strip.hold.label).toBe(COPY.deploy.hold);
    expect(d.cardLine).toBeNull();
    expect(d.dot).toBe('pos');
  });

  it('blocked: the reason, verbatim, and a hold that cannot start', () => {
    const d = deployDisplay({ displayState: 'blocked', canStart: true, reason: 'session not eligible' });
    expect(d.status).toBe('Unavailable · session not eligible');
    expect(d.canStart).toBe(false);
    expect(d.cardLine).toEqual({ icon: 'lock', text: 'Unavailable · session not eligible', retry: false });
  });

  it('eligibility_error: Retry instead of the hold on the strip, Retry beside the line on the card', () => {
    const d = deployDisplay({ displayState: 'eligibility_error', canStart: false });
    expect(d.status).toBe('Eligibility unavailable');
    expect(d.strip).toEqual({ openGame: false, hold: null, retry: true });
    expect(d.cardLine).toEqual({ icon: 'info', text: 'Eligibility unavailable', retry: true });
  });

  it('submitting: Shadow processes, no retry, the hold reads Submitting…', () => {
    const d = deployDisplay({ displayState: 'submitting', canStart: false });
    expect(d.processing).toBe(true);
    expect(d.strip.retry).toBe(false);
    expect(d.strip.hold.label).toBe(COPY.deploy.holdSubmitting);
    expect(d.cardHoldLabel).toBe(COPY.deploy.holdSubmitting);
    expect(d.dot).toBe('blue-action');
  });

  it('confirmed: "Deployed", and the card says the game appears in Games (never "above": tablet and stacked put Deploy over Games)', () => {
    const d = deployDisplay({ displayState: 'confirmed', canStart: false });
    expect(d.stripLine1).toBe('Deployed');
    expect(d.cardLine.text).toBe(COPY.deploy.cardConfirmed);
    expect(d.cardLine.text).not.toMatch(/above/);
    expect(d.processing).toBe(false);
  });
});

describe('a live game (spec §10)', () => {
  it('takes the first line and offers Open game; a blocked deploy moves to the second line and drops the hold', () => {
    const d = deployDisplay({ displayState: 'blocked', canStart: false, reason: 'capacity 1 of 1 in use' }, LIVE);
    expect(d.stripLine1).toBe('Live · 2h 41m left');
    expect(d.stripLine2(LOADOUT)).toBe('Deploy unavailable · capacity 1 of 1 in use');
    expect(d.strip).toEqual({ openGame: true, hold: null, retry: false });
    expect(d.dot).toBe('teal');
  });

  it('ranked-only live with deploy still ready: Open game AND the hold, one row, the loadout on line two', () => {
    const d = deployDisplay({ displayState: 'ready', canStart: true }, LIVE);
    expect(d.strip.openGame).toBe(true);
    expect(d.strip.hold).toEqual({ label: COPY.deploy.holdShort, secondary: true });
    expect(d.stripLine2(LOADOUT)).toBe(LOADOUT);
  });

  it('a deployed game waiting for the open says so', () => {
    expect(deployDisplay({ displayState: 'checking' }, PRE_OPEN).stripLine1).toBe('Deployed · opens 9:30 AM ET');
  });

  it('checking or error behind a live game shows on line two', () => {
    expect(deployDisplay({ displayState: 'checking' }, LIVE).stripLine2(LOADOUT)).toBe('Checking eligibility…');
    expect(deployDisplay({ displayState: 'eligibility_error' }, LIVE).stripLine2(LOADOUT)).toBe('Eligibility unavailable');
    expect(deployDisplay({ displayState: 'eligibility_error' }, LIVE).strip.retry).toBe(false);
  });

  it('an in-flight deployment keeps the first line over a live game', () => {
    const d = deployDisplay({ displayState: 'submitting' }, LIVE);
    expect(d.stripLine1).toBe('Submitting deployment…');
    expect(d.strip.openGame).toBe(false);
    expect(d.stripLine2(LOADOUT)).toBe(LOADOUT);
  });
});

describe('the status words are phase words: no percentage anywhere (spec §5.5, §10)', () => {
  it('no state string, strip line or card line carries a percent', () => {
    for (const state of DEPLOY_DISPLAY_STATES) {
      for (const live of [null, LIVE]) {
        const d = deployDisplay({ displayState: state, canStart: true, reason: 'x' }, live);
        expect(`${d.status} ${d.stripLine1} ${d.stripLine2(LOADOUT)} ${d.cardLine?.text ?? ''}`).not.toMatch(/%|\d+\s*percent/i);
      }
    }
    expect(`${COPY.shadow.statusIdle} ${COPY.shadow.statusSubmitting}`).not.toMatch(/%/);
  });
});
