// src/components/CommandCenter/hub/shadowStatus.test.js
//
// Command Center hub, slice S7 — the status line's words (hub/shadowStatus.js;
// ruling R-S7-7), in priority order, and the card's own words reused for an
// attempt (BUILD_RULES §9): the line and the Deploy card cannot disagree because
// the line takes the string deployDisplay built for the card.

import { describe, expect, it } from 'vitest';
import { deployDisplay } from './deployDisplay';
import { HUB_COPY as COPY } from './hubCopy';
import { ATTEMPT_WORDS, HOLD, liveReadKnown, shadowStatusWords } from './shadowStatus';
import { ATTEMPT_DISPLAY, HOLD_PHASES } from './selectors/attemptVocabulary';

const display = (displayState, extra = {}) => deployDisplay({ displayState, canStart: false, ...extra });
const words = (over = {}) => shadowStatusWords({ holdPhase: null, display: display('ready', { canStart: true }), liveCount: 0, liveKnown: true, ...over });

describe('the seven rules, each alone', () => {
  it('1: a hold charging says "Holding to deploy", locked says "Locked in"', () => {
    expect(words({ holdPhase: 'charging' })).toBe('Holding to deploy');
    expect(words({ holdPhase: 'locked' })).toBe('Locked in');
  });

  it('2: a hub-started deployment submitting says "Submitting your deployment"', () => {
    expect(words({ display: display('submitting') })).toBe('Submitting your deployment');
  });

  it('3: verifying and finishing are the Deploy card\'s own words', () => {
    expect(words({ display: display('verifying') })).toBe(COPY.deploy.states.verifying);
    expect(words({ display: display('finishing') })).toBe(COPY.deploy.states.finishing);
    expect(COPY.deploy.states.verifying).toBe('Verifying deployment…');
    expect(COPY.deploy.states.finishing).toBe('Finishing deployment');
  });

  it('4: an attempt\'s terminal is the card\'s own word, until acknowledged', () => {
    expect(words({ display: display('confirmed') })).toBe('Deployed');
    expect(words({ display: display('confirmed', { recovered: true }) })).toBe('Battle confirmed');
    expect(words({ display: display('existing') })).toBe('Already running');
    expect(words({ display: display('failed') })).toBe('Deployment refused');
    expect(words({ display: display('failed', { reason: 'A deploy is already in progress' }) })).toBe('Deployment refused');
    expect(words({ display: display('uncertain') })).toBe('Couldn’t confirm the deploy');
  });

  it('5: an owned live game with no attempt shown: one, or n', () => {
    expect(words({ liveCount: 1 })).toBe('Live game in progress');
    expect(words({ liveCount: 2 })).toBe('2 live games in progress');
    expect(words({ liveCount: 3 })).toBe('3 live games in progress');
  });

  it('6: the owned live read is not known: "Idle", claiming nothing', () => {
    expect(words({ liveKnown: false })).toBe('Idle');
  });

  it('7: otherwise "Idle · nothing running"', () => {
    expect(words()).toBe('Idle · nothing running');
    expect(COPY.shadow.statusIdle).toBe('Idle · nothing running');
  });
});

describe('priority — each rule beats every rule below it', () => {
  const live = { liveCount: 2, liveKnown: true };

  it('a hold beats submitting, the attempt words and a live game', () => {
    expect(words({ holdPhase: 'charging', display: display('submitting'), ...live })).toBe('Holding to deploy');
    expect(words({ holdPhase: 'locked', display: display('confirmed'), ...live })).toBe('Locked in');
  });

  it('submitting beats a live game; an attempt\'s words beat a live game', () => {
    expect(words({ display: display('submitting'), ...live })).toBe('Submitting your deployment');
    for (const [state, word] of [['verifying', 'Verifying deployment…'], ['confirmed', 'Deployed'], ['existing', 'Already running'], ['failed', 'Deployment refused'], ['uncertain', 'Couldn’t confirm the deploy']]) {
      expect(words({ display: display(state), ...live }), state).toBe(word);
    }
  });

  it('a live game beats an unknown read (a retained list stands when a refresh failed: the card beside it says "as of")', () => {
    expect(words({ liveCount: 1, liveKnown: false })).toBe('Live game in progress');
  });

  it('an attempt shown beats the unknown read: its terminal still reads', () => {
    expect(words({ display: display('uncertain'), liveKnown: false })).toBe('Couldn’t confirm the deploy');
  });

  it('a display state that is not an attempt (checking, blocked, ready, cooldown …) never decides the words', () => {
    for (const state of ['checking', 'loading_agent', 'agent_error', 'no_agent', 'blocked', 'eligibility_error', 'ready_stale', 'ready', 'signed_out', 'account_transition']) {
      expect(words({ display: display(state) }), state).toBe('Idle · nothing running');
    }
    expect(words({ display: display('cooldown', { cooldownUntil: Date.now() + 60000 }) })).toBe('Idle · nothing running');
  });
});

describe('only phases are announced', () => {
  it('no word carries a percentage or a number but the live count', () => {
    for (const w of [words({ holdPhase: 'charging' }), words({ holdPhase: 'locked' }), words({ display: display('submitting') }), words({ display: display('finishing') }), words({ liveCount: 1 }), words({ liveKnown: false }), words()]) {
      expect(w).not.toMatch(/%|\d/);
    }
    expect(words({ liveCount: 4 })).toBe('4 live games in progress');
  });

  it('names no learning, improvement or thought', () => {
    const all = [COPY.shadow.statusLiveOne, COPY.shadow.statusLiveMany(2), COPY.shadow.statusIdleUnknown, COPY.shadow.statusIdle, COPY.shadow.statusSubmitting, COPY.shadow.statusHolding, COPY.shadow.statusLocked];
    for (const w of all) expect(w).not.toMatch(/learn|improv|think|smart|intelligen|adapt|evolv|train/i);
  });
});

describe('a game deployed after hours is not "in progress" (review C-1; BUILD_RULES §9)', () => {
  it('games waiting for the open say what the strip says, built from the strip\'s own copy — and never "in progress"', () => {
    expect(words({ waitingCount: 1 })).toBe('Deployed · waiting for the open');
    expect(words({ waitingCount: 2 })).toBe('Deployed · waiting for the open');
    expect(words({ waitingCount: 1 })).toBe(COPY.strip.deployed(COPY.games.waitingForOpen));
  });

  it('one that has opened beats one still waiting, and the count is the opened ones alone', () => {
    expect(words({ liveCount: 1, waitingCount: 1 })).toBe('Live game in progress');
    expect(words({ liveCount: 2, waitingCount: 3 })).toBe('2 live games in progress');
  });

  it('an attempt shown still beats it, and so does nothing below: the waiting phrase is rule 5\'s', () => {
    expect(words({ waitingCount: 1, display: display('uncertain') })).toBe('Couldn’t confirm the deploy');
    expect(words({ waitingCount: 1, liveKnown: false })).toBe('Deployed · waiting for the open');
  });
});

describe('liveReadKnown — can the owned live read be said to be known?', () => {
  it('the connected hub says so itself (liveResolved), whatever the completed window or the gate says', () => {
    expect(liveReadKnown({ status: 'loading', liveResolved: true }, { gateBlocked: null })).toBe(true);
    expect(liveReadKnown({ status: 'ready', liveResolved: false }, { gateBlocked: false })).toBe(false);
    expect(liveReadKnown({ status: 'error', liveResolved: false })).toBe(false);
  });

  it('without that key (the layout fixtures) the live read\'s own answer is the selector\'s gate, never the completed window\'s status', () => {
    expect(liveReadKnown({ status: 'ready', rows: [] }, { gateBlocked: false })).toBe(true);
    expect(liveReadKnown({ status: 'ready', rows: [] }, { gateBlocked: true })).toBe(true);
    expect(liveReadKnown({ status: 'ready', rows: [] }, { gateBlocked: null })).toBe(false);
    expect(liveReadKnown({ status: 'loading', rows: [] }, { gateBlocked: false })).toBe(true);
    expect(liveReadKnown({ status: 'ready', rows: [] })).toBe(false);
    expect(liveReadKnown(undefined, undefined)).toBe(false);
    expect(liveReadKnown(null, null)).toBe(false);
  });

  it('a failed refresh takes the knowledge back — nothing running cannot be said from stale data — and a refresh in flight does not', () => {
    expect(liveReadKnown({ liveResolved: true }, { freshness: { stale: true } })).toBe(false);
    expect(liveReadKnown({ status: 'ready' }, { gateBlocked: false, freshness: { stale: true } })).toBe(false);
    expect(liveReadKnown({ liveResolved: true }, { freshness: { stale: false, refreshing: true } })).toBe(true);
    expect(liveReadKnown({ status: 'ready' }, { gateBlocked: false, freshness: { stale: false, refreshing: true } })).toBe(true);
  });

  it('with the knowledge gone and nothing live the line says "Idle"; a retained live game is still said', () => {
    expect(words({ liveKnown: liveReadKnown({ liveResolved: true }, { freshness: { stale: true } }) })).toBe('Idle');
    expect(words({ liveCount: 1, liveKnown: liveReadKnown({ liveResolved: true }, { freshness: { stale: true } }) })).toBe('Live game in progress');
  });
});

describe('the tokens spelled here are the vocabulary’s (kept out of the entry chunk, so pinned here)', () => {
  it('the hold phases', () => {
    expect(HOLD.CHARGING).toBe(HOLD_PHASES.CHARGING);
    expect(HOLD.LOCKED).toBe(HOLD_PHASES.LOCKED);
    expect(Object.keys(HOLD)).toHaveLength(2);
  });

  it('the attempt display words the line takes from the card', () => {
    for (const [key, word] of Object.entries(ATTEMPT_WORDS)) expect(ATTEMPT_DISPLAY[key], key).toBe(word);
    expect(Object.keys(ATTEMPT_WORDS).sort()).toEqual(['CONFIRMED', 'EXISTING', 'FAILED', 'FINISHING', 'UNCERTAIN', 'VERIFYING']);
  });
});

describe('every opened game past its end time is the strip\'s "Live · ending" (the S8 review K-1; ruling R-S8F-7)', () => {
  it('one or several, all past their end: "Live · ending", from the strip\'s own copy, never "in progress"', () => {
    expect(words({ liveCount: 1, allEnding: true })).toBe(COPY.strip.live(COPY.games.ending));
    expect(words({ liveCount: 3, allEnding: true })).toBe('Live · ending');
    expect(words({ liveCount: 1, waitingCount: 2, allEnding: true })).toBe('Live · ending');
  });

  it('not every one of them: the count, as before; a hold or an attempt still comes first; nothing opened, nothing ending', () => {
    expect(words({ liveCount: 2, allEnding: false })).toBe('2 live games in progress');
    expect(words({ liveCount: 1, allEnding: true, holdPhase: HOLD.CHARGING })).toBe(COPY.shadow.statusHolding);
    expect(words({ liveCount: 1, allEnding: true, display: display('uncertain') })).toBe('Couldn’t confirm the deploy');
    expect(words({ waitingCount: 1, allEnding: true })).toBe('Deployed · waiting for the open');
  });
});
