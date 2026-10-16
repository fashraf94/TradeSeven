// src/components/CommandCenter/hub/deployDisplay.test.js
//
// Command Center hub — the strip's and the Deploy card's state table (spec
// V1.2 §3.1, §5.2, §10; the design's GameStrip / DeploySection). Slice S1 laid
// it down; slice S2a extends it to the whole vocabulary. The table translates
// the selector's result; it never decides.

import { describe, expect, it } from 'vitest';
import { DUE_DEPLOY_LINE } from '../../../constants/hypothesisRecords';
import { DEPLOY_BLOCK_REASON } from '../../../utils/commandCenterLiveBattles';
import { DEPLOY_DISPLAY_STATES, DISPLAY_ACTIONS, deployDisplay } from './deployDisplay';
import { HUB_COPY as COPY } from './hubCopy';

const LOADOUT = 'Speculator · High-Beta Ten';
const LIVE = { clock: '2h 41m left' };
const PRE_OPEN = { clock: 'opens 9:30 AM ET', preOpen: true };
/** 10:40:20 AM ET on Oct 14 (EDT). */
const T = Date.UTC(2026, 9, 14, 14, 40, 20);

describe('the vocabulary (spec §3.1, §5.2 — display words)', () => {
  it('renders the §3.1 eligibility states, then the §5.2 attempt words', () => {
    expect(DEPLOY_DISPLAY_STATES).toEqual([
      'signed_out', 'account_transition', 'cooldown', 'loading_agent', 'agent_error', 'no_agent',
      'blocked', 'eligibility_error', 'checking', 'ready_stale', 'ready',
      'submitting', 'verifying', 'finishing', 'confirmed', 'existing', 'failed', 'uncertain',
    ]);
  });

  it('the provider-only phases are never display keys: idle, created, refused and orphaned', () => {
    for (const phase of ['idle', 'created', 'refused', 'orphaned']) {
      expect(DEPLOY_DISPLAY_STATES).not.toContain(phase);
      expect(Object.keys(COPY.deploy.states)).not.toContain(phase);
    }
  });

  it('existing and uncertain are both a stored phase and a display word in §5.2, so both are keys here (S2a revises S1\'s row)', () => {
    expect(DEPLOY_DISPLAY_STATES).toEqual(expect.arrayContaining(['existing', 'uncertain']));
  });

  it('every state has its words in hubCopy, and the copy table holds no other state', () => {
    expect(Object.keys(COPY.deploy.states).sort()).toEqual([...DEPLOY_DISPLAY_STATES].sort());
  });

  it.each([
    undefined, null, {}, { displayState: 'created' }, { displayState: 'refused', canStart: true }, { displayState: 'READY', canStart: true },
    { displayState: 'idle', canStart: true }, { displayState: 'orphaned' }, { displayState: 'cooldown', cooldownUntil: null }, { displayState: 'cooldown' },
  ])('an unknown, stored-phase or unrenderable input (%j) fails closed to checking, with nothing able to start', (deploy) => {
    const d = deployDisplay(deploy);
    expect(d.displayState).toBe('checking');
    expect(d.canStart).toBe(false);
    expect(d.status).toBe(COPY.deploy.states.checking);
  });
});

describe('the spec\'s words, exactly (prompt §4.5)', () => {
  it.each([
    ['account_transition', 'Switching account…'],
    ['no_agent', 'Create your agent first'],
    ['eligibility_error', 'Eligibility unavailable'],
    ['checking', 'Checking eligibility…'],
    ['finishing', 'Finishing deployment'],
    ['confirmed', 'Deployed'],
    ['existing', 'Already running'],
    ['uncertain', 'Couldn’t confirm the deploy'],
    ['signed_out', 'Sign in required'],
  ])('%s → %s', (displayState, words) => {
    expect(deployDisplay({ displayState }).status).toBe(words);
  });

  it('ready_stale → "Ready to deploy · as of {time}" in ET; a recovered confirmation → "Battle confirmed"', () => {
    expect(deployDisplay({ displayState: 'ready_stale', canStart: true, freshness: { asOf: T, stale: true } }).status).toBe('Ready to deploy · as of 10:40 AM ET');
    expect(deployDisplay({ displayState: 'confirmed', recovered: true }).status).toBe('Battle confirmed');
    expect(deployDisplay({ displayState: 'confirmed', recovered: false }).status).toBe('Deployed');
  });

  it('cooldown → the next permitted deploy time, rounded UP to the minute so it never reads early', () => {
    expect(deployDisplay({ displayState: 'cooldown', cooldownUntil: T }).status).toBe('Next deploy at 10:41 AM ET');
    expect(deployDisplay({ displayState: 'cooldown', cooldownUntil: Date.UTC(2026, 9, 14, 14, 41) }).status).toBe('Next deploy at 10:41 AM ET');
  });

  it('the failed and uncertain words are the shipped ceremony\'s (CeremonyError.jsx)', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../Dashboard/deployCeremony/CeremonyError.jsx'), 'utf8');
    expect(src).toContain(`'${COPY.deploy.states.failed}'`);
    expect(src).toContain(`'${COPY.deploy.states.uncertain}.'`);
  });
});

describe('S1 production: checking eligibility', () => {
  const d = deployDisplay({ displayState: 'checking', canStart: false });
  it('reads "Checking eligibility…" on both surfaces, with the hold present and nothing able to start', () => {
    expect(d.status).toBe('Checking eligibility…');
    expect(d.stripLine1).toBe('Checking eligibility…');
    expect(d.stripLine2(LOADOUT)).toBe(LOADOUT);
    expect(d.strip).toEqual({ openGame: false, hold: { label: COPY.deploy.holdShort, secondary: false }, action: null });
    expect(d.cardLine).toEqual({ icon: null, text: 'Checking eligibility…', action: null });
    expect(d.cardNote).toBeNull();
    expect(d.canStart).toBe(false);
    expect(d.processing).toBe(false);
  });

  it('the agent loading reads the same words, with the same composition (no flicker of two lines)', () => {
    const a = deployDisplay({ displayState: 'loading_agent', canStart: false });
    expect(a.status).toBe(d.status);
    expect(a.strip).toEqual(d.strip);
    expect(a.cardLine).toEqual(d.cardLine);
  });
});

describe('the eligibility states (§3.1)', () => {
  it('ready: "Ready to deploy", the hold, and canStart only when the selector said so', () => {
    expect(deployDisplay({ displayState: 'ready', canStart: true }).canStart).toBe(true);
    expect(deployDisplay({ displayState: 'ready', canStart: false }).canStart).toBe(false);
    expect(deployDisplay({ displayState: 'ready', canStart: 'yes' }).canStart).toBe(false);
    const d = deployDisplay({ displayState: 'ready', canStart: true });
    expect(d.stripLine1).toBe('Ready to deploy');
    expect(d.strip.hold.label).toBe(COPY.deploy.hold);
    expect(d.cardLine).toBeNull();
    expect(d.cardNote).toBeNull();
    expect(d.dot).toBe('pos');
  });

  it('ready with a refresh pending: the refreshing note with the retained as-of time, still able to start', () => {
    const d = deployDisplay({ displayState: 'ready', canStart: true, freshness: { asOf: T, stale: false, refreshing: true } });
    expect(d.canStart).toBe(true);
    expect(d.cardNote).toEqual({ text: 'Refreshing · as of 10:40 AM ET', action: null });
  });

  it('ready_stale: able to start, the as-of words on the line, and the poll\'s Retry in the note', () => {
    const d = deployDisplay({ displayState: 'ready_stale', canStart: true, freshness: { asOf: T, stale: true }, retryAction: 'poll' });
    expect(d.canStart).toBe(true);
    expect(d.stripLine1).toBe('Ready to deploy · as of 10:40 AM ET');
    expect(d.cardLine).toEqual({ icon: 'info', text: 'Ready to deploy · as of 10:40 AM ET', action: null });
    expect(d.cardNote).toEqual({ text: COPY.deploy.refreshFailed, action: { kind: 'retryRead', label: 'Retry' } });
  });

  it('A1-1: the strip says it too — alone, the refresh failure on line two; beside a live game, when it was true; the read\'s Retry stays on the card', () => {
    const stale = { displayState: 'ready_stale', canStart: true, freshness: { asOf: T, stale: true }, retryAction: 'poll' };
    const alone = deployDisplay(stale);
    expect(alone.stripLine1).toBe('Ready to deploy · as of 10:40 AM ET');
    expect(alone.stripLine2(LOADOUT)).toBe(COPY.deploy.refreshFailed);
    expect(alone.strip).toEqual({ openGame: false, hold: { label: COPY.deploy.hold, secondary: false }, action: null });
    const live = deployDisplay(stale, LIVE);
    expect(live.stripLine1).toBe('Live · 2h 41m left');
    expect(live.stripLine2(LOADOUT)).toBe('As of 10:40 AM ET · couldn’t refresh');
    expect(live.strip).toEqual({ openGame: true, hold: { label: COPY.deploy.holdShort, secondary: true }, action: null });
    // A pending refresh: the retained time on line two — for a clear list alone or beside a live game, for a block alone.
    const refreshing = { displayState: 'ready', canStart: true, freshness: { asOf: T, stale: false, refreshing: true } };
    expect(deployDisplay(refreshing).stripLine2(LOADOUT)).toBe('Refreshing · as of 10:40 AM ET');
    expect(deployDisplay(refreshing, LIVE).stripLine2(LOADOUT)).toBe('Refreshing · as of 10:40 AM ET');
    const blockedRefreshing = { displayState: 'blocked', reason: DEPLOY_BLOCK_REASON, freshness: { asOf: T, refreshing: true } };
    expect(deployDisplay(blockedRefreshing).stripLine2(LOADOUT)).toBe('Refreshing · as of 10:40 AM ET');
    expect(deployDisplay(blockedRefreshing, LIVE).stripLine2(LOADOUT)).toBe(`Deploy unavailable · ${DEPLOY_BLOCK_REASON}`);
    // A fresh ready list keeps the loadout.
    expect(deployDisplay({ displayState: 'ready', canStart: true, freshness: { asOf: T } }).stripLine2(LOADOUT)).toBe(LOADOUT);
  });

  it('blocked: the reason, verbatim, and a hold that cannot start; a stale block says when it was true, with Retry', () => {
    const d = deployDisplay({ displayState: 'blocked', canStart: true, reason: DEPLOY_BLOCK_REASON });
    expect(d.status).toBe(`Unavailable · ${DEPLOY_BLOCK_REASON}`);
    expect(d.canStart).toBe(false);
    expect(d.cardLine).toEqual({ icon: 'lock', text: d.status, action: null });
    const stale = deployDisplay({ displayState: 'blocked', reason: DEPLOY_BLOCK_REASON, freshness: { asOf: T, stale: true } });
    expect(stale.cardNote).toEqual({ text: 'As of 10:40 AM ET · couldn’t refresh', action: { kind: 'retryRead', label: 'Retry' } });
    const refreshing = deployDisplay({ displayState: 'blocked', reason: DEPLOY_BLOCK_REASON, freshness: { asOf: T, refreshing: true } });
    expect(refreshing.cardNote).toEqual({ text: 'Refreshing · as of 10:40 AM ET', action: null });
  });

  it('a stale block says when it was true on the strip too: beside a live game in place of the reason, else in place of the loadout', () => {
    const stale = { displayState: 'blocked', reason: DEPLOY_BLOCK_REASON, freshness: { asOf: T, stale: true } };
    expect(deployDisplay(stale, LIVE).stripLine2(LOADOUT)).toBe('Deploy unavailable · as of 10:40 AM ET');
    expect(deployDisplay(stale).stripLine1).toBe(`Unavailable · ${DEPLOY_BLOCK_REASON}`);
    expect(deployDisplay(stale).stripLine2(LOADOUT)).toBe('As of 10:40 AM ET · couldn’t refresh');
    // A fresh block keeps the reason and the loadout.
    const fresh = { ...stale, freshness: { asOf: T, stale: false } };
    expect(deployDisplay(fresh, LIVE).stripLine2(LOADOUT)).toBe(`Deploy unavailable · ${DEPLOY_BLOCK_REASON}`);
    expect(deployDisplay(fresh).stripLine2(LOADOUT)).toBe(LOADOUT);
  });

  it('blocked with no reason (concurrency off: the helper gives none) reads "Unavailable", never a dangling separator', () => {
    expect(deployDisplay({ displayState: 'blocked', reason: null }).status).toBe('Unavailable');
    expect(deployDisplay({ displayState: 'blocked', reason: null }, LIVE).stripLine2(LOADOUT)).toBe('Deploy unavailable');
  });

  it.each(['eligibility_error', 'agent_error'])('%s: the read\'s Retry instead of the hold on the strip, beside the line on the card', (displayState) => {
    const d = deployDisplay({ displayState, canStart: false });
    expect(d.strip).toEqual({ openGame: false, hold: null, action: { kind: 'retryRead', label: 'Retry' } });
    expect(d.cardLine).toEqual({ icon: 'info', text: d.status, action: { kind: 'retryRead', label: 'Retry' } });
  });

  it.each(['signed_out', 'account_transition', 'no_agent'])('%s: a disabled hold and the words on the line', (displayState) => {
    const d = deployDisplay({ displayState, canStart: true });
    expect(d.canStart).toBe(false);
    expect(d.strip).toEqual({ openGame: false, hold: { label: COPY.deploy.holdShort, secondary: false }, action: null });
    expect(d.cardLine.text).toBe(d.status);
  });

  it('cooldown: a disabled hold and the next deploy time, locked', () => {
    const d = deployDisplay({ displayState: 'cooldown', cooldownUntil: T, canStart: true });
    expect(d.canStart).toBe(false);
    expect(d.cardLine).toEqual({ icon: 'lock', text: 'Next deploy at 10:41 AM ET', action: null });
  });
});

describe('the attempt words (§5.2): no live hold while in flight or terminal; one action in the hold\'s place', () => {
  it('submitting: Shadow processes, no action, the control reads Submitting…', () => {
    const d = deployDisplay({ displayState: 'submitting', canStart: false });
    expect(d.processing).toBe(true);
    expect(d.strip.action).toBeNull();
    expect(d.strip.hold.label).toBe(COPY.deploy.holdSubmitting);
    expect(d.cardHoldLabel).toBe(COPY.deploy.holdSubmitting);
    expect(d.dot).toBe('blue-action');
  });

  it.each([['verifying', 'Verifying…', 'Verifying deployment…'], ['finishing', 'Finishing…', 'Finishing deployment']])('%s: the control reports its phase; no new write is claimed', (displayState, label, words) => {
    const d = deployDisplay({ displayState, canStart: true });
    expect(d.canStart).toBe(false);
    expect(d.processing).toBe(false);
    expect(d.strip.hold).toEqual({ label, secondary: false });
    expect(d.cardHoldLabel).toBe(label);
    expect(d.cardLine).toEqual({ icon: null, text: words, action: null });
    expect(`${d.status} ${d.cardLine.text}`).not.toMatch(/Submitting/);
  });

  it('confirmed: "Deployed", and the card says the game appears in Games (never "above"); with Enter battle it takes the hold\'s place', () => {
    const plain = deployDisplay({ displayState: 'confirmed', canStart: false });
    expect(plain.stripLine1).toBe('Deployed');
    // Without its action the control reports the phase on the strip (A5 refuter, DD-16).
    expect(plain.strip.hold).toEqual({ label: COPY.deploy.holdDeployed, secondary: false });
    expect(plain.cardLine.text).toBe(COPY.deploy.cardConfirmed);
    expect(plain.cardLine.text).not.toMatch(/above/);
    expect(plain.processing).toBe(false);
    const enter = deployDisplay({ displayState: 'confirmed', action: 'enterBattle' });
    expect(enter.strip).toEqual({ openGame: false, hold: null, action: { kind: 'enterBattle', label: 'Enter battle' } });
    expect(enter.cardLine.action).toEqual({ kind: 'enterBattle', label: 'Enter battle' });
  });

  it('a recovered confirmation never says "Deployed" on the control: nothing proves this request created it', () => {
    const d = deployDisplay({ displayState: 'confirmed', recovered: true });
    expect(d.cardHoldLabel).toBe('Battle confirmed');
    expect(d.cardLine.text).toBe('Battle confirmed');
    expect(`${d.status} ${d.cardHoldLabel} ${d.cardLine.text}`).not.toMatch(/Deployed/);
  });

  it('existing: "Already running" with Open game, never a creation', () => {
    const d = deployDisplay({ displayState: 'existing', action: 'openGame' });
    expect(d.strip).toEqual({ openGame: false, hold: null, action: { kind: 'openGame', label: 'Open game' } });
    expect(d.cardLine).toEqual({ icon: 'info', text: 'Already running', action: { kind: 'openGame', label: 'Open game' } });
  });

  it('A1-4: on a terminal with its own action the card\'s control reports the phase, as in flight — never the hold\'s words', () => {
    expect(deployDisplay({ displayState: 'failed' }).cardHoldLabel).toBe('Deployment failed');
    expect(deployDisplay({ displayState: 'existing' }).cardHoldLabel).toBe('Already running');
    expect(deployDisplay({ displayState: 'uncertain' }).cardHoldLabel).toBe('Couldn’t confirm the deploy');
    for (const displayState of ['submitting', 'verifying', 'finishing', 'confirmed', 'existing', 'failed', 'uncertain']) {
      expect([COPY.deploy.hold, COPY.deploy.holdShort], displayState).not.toContain(deployDisplay({ displayState }).cardHoldLabel);
    }
    for (const displayState of ['checking', 'ready', 'ready_stale', 'blocked', 'cooldown']) {
      expect(deployDisplay({ displayState, cooldownUntil: T }).cardHoldLabel, displayState).toBe(COPY.deploy.hold);
    }
  });

  it('A1-2: a withheld Retry says why — the next deploy time, the block, the read still checking — on the card and on line two', () => {
    const cooling = deployDisplay({ displayState: 'uncertain', action: null, retryBlock: { displayState: 'cooldown', cooldownUntil: T, reason: null } });
    expect(cooling.strip.action).toBeNull();
    expect(cooling.cardNote).toEqual({ text: 'Next deploy at 10:41 AM ET', action: null });
    expect(cooling.stripLine2(LOADOUT)).toBe('Next deploy at 10:41 AM ET');
    const blocked = deployDisplay({ displayState: 'failed', reason: '', action: null, retryBlock: { displayState: 'blocked', reason: DEPLOY_BLOCK_REASON, cooldownUntil: null } });
    expect(blocked.cardNote.text).toBe(`Unavailable · ${DEPLOY_BLOCK_REASON}`);
    expect(blocked.stripLine2(LOADOUT)).toBe(`Unavailable · ${DEPLOY_BLOCK_REASON}`);
    // A refusal's own words keep line two.
    const worded = deployDisplay({ displayState: 'failed', reason: 'Please wait 2 minutes between deploys', retryBlock: { displayState: 'cooldown', cooldownUntil: T } });
    expect(worded.stripLine2(LOADOUT)).toBe('Please wait 2 minutes between deploys');
    expect(worded.cardNote.text).toBe('Next deploy at 10:41 AM ET');
    // Nothing is said when the block would only read "ready" (or "ready, stale"), and an eligibility state never carries one.
    expect(deployDisplay({ displayState: 'uncertain', retryBlock: { displayState: 'ready' } }).cardNote).toBeNull();
    expect(deployDisplay({ displayState: 'failed', retryBlock: { displayState: 'ready_stale' } }).cardNote).toBeNull();
    expect(deployDisplay({ displayState: 'ready', canStart: true, retryBlock: { displayState: 'cooldown', cooldownUntil: T } }).cardNote).toBeNull();
    // A cooldown block without a bound reads as checking, never "Next deploy at ".
    expect(deployDisplay({ displayState: 'uncertain', retryBlock: { displayState: 'cooldown', cooldownUntil: null } }).cardNote.text).toBe(COPY.deploy.states.checking);
  });

  it('failed: "Deployment failed", the server\'s line unchanged on line two and the card, Retry or the Forge', () => {
    const due = deployDisplay({ displayState: 'failed', reason: DUE_DEPLOY_LINE, action: 'openForgeReview' });
    expect(due.stripLine1).toBe('Deployment failed');
    expect(due.stripLine2(LOADOUT)).toBe(DUE_DEPLOY_LINE);
    expect(due.cardLine).toEqual({ icon: 'info', text: DUE_DEPLOY_LINE, action: { kind: 'openForgeReview', label: 'Open in the Forge' } });
    expect(due.strip.action).toEqual({ kind: 'openForgeReview', label: 'Open in the Forge' });
    const other = deployDisplay({ displayState: 'failed', reason: '', action: 'retry' });
    expect(other.cardLine.text).toBe('Deployment failed');
    expect(other.stripLine2(LOADOUT)).toBe(LOADOUT);
    expect(other.strip.action).toEqual({ kind: 'retry', label: 'Retry' });
  });

  it('uncertain: "Couldn\'t confirm the deploy" with Check deployment; nothing while a check runs; Retry once clear', () => {
    expect(deployDisplay({ displayState: 'uncertain', action: 'checkDeployment' }).strip.action).toEqual({ kind: 'checkDeployment', label: 'Check deployment' });
    expect(deployDisplay({ displayState: 'uncertain', action: null }).strip).toEqual({ openGame: false, hold: null, action: null });
    expect(deployDisplay({ displayState: 'uncertain', action: 'retry' }).cardLine.action).toEqual({ kind: 'retry', label: 'Retry' });
  });

  it('an attempt\'s Retry and a read\'s Retry are different actions, so wiring one never starts the other', () => {
    expect(DISPLAY_ACTIONS.RETRY).toBe('retry');
    expect(DISPLAY_ACTIONS.RETRY_READ).toBe('retryRead');
    expect(deployDisplay({ displayState: 'eligibility_error' }).strip.action.kind).toBe('retryRead');
    expect(deployDisplay({ displayState: 'failed', action: 'retry' }).strip.action.kind).toBe('retry');
    // An action the vocabulary does not know is dropped, not shown.
    expect(deployDisplay({ displayState: 'failed', action: 'reaffirm' }).strip.action).toBeNull();
    // An eligibility state never carries an attempt's action.
    expect(deployDisplay({ displayState: 'ready', canStart: true, action: 'retry' }).strip.action).toBeNull();
  });
});

describe('a live game (spec §10)', () => {
  it('takes the first line and offers Open game; a blocked deploy moves to the second line and drops the hold', () => {
    const d = deployDisplay({ displayState: 'blocked', canStart: false, reason: DEPLOY_BLOCK_REASON }, LIVE);
    expect(d.stripLine1).toBe('Live · 2h 41m left');
    expect(d.stripLine2(LOADOUT)).toBe(`Deploy unavailable · ${DEPLOY_BLOCK_REASON}`);
    expect(d.strip).toEqual({ openGame: true, hold: null, action: null });
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

  it('a waiting or error state behind a live game shows on line two, and the read\'s Retry stays off the crowded strip', () => {
    expect(deployDisplay({ displayState: 'checking' }, LIVE).stripLine2(LOADOUT)).toBe('Checking eligibility…');
    expect(deployDisplay({ displayState: 'eligibility_error' }, LIVE).stripLine2(LOADOUT)).toBe('Eligibility unavailable');
    expect(deployDisplay({ displayState: 'eligibility_error' }, LIVE).strip.action).toBeNull();
    expect(deployDisplay({ displayState: 'cooldown', cooldownUntil: T }, LIVE).stripLine2(LOADOUT)).toBe('Next deploy at 10:41 AM ET');
    expect(deployDisplay({ displayState: 'account_transition' }, LIVE).stripLine2(LOADOUT)).toBe('Switching account…');
  });

  it('an attempt keeps the first line over a live game, and Open game gives way to its own action', () => {
    const d = deployDisplay({ displayState: 'submitting' }, LIVE);
    expect(d.stripLine1).toBe('Submitting deployment…');
    expect(d.strip.openGame).toBe(false);
    expect(d.stripLine2(LOADOUT)).toBe(LOADOUT);
    const existing = deployDisplay({ displayState: 'existing', action: 'openGame' }, LIVE);
    expect(existing.stripLine1).toBe('Already running');
    expect(existing.strip).toEqual({ openGame: false, hold: null, action: { kind: 'openGame', label: 'Open game' } });
  });
});

describe('S2a review fixes — the test-integrity lens\'s display rows (A5-12, A5-15)', () => {
  it('A5-12: with no time to show, every as-of or refresh line drops its time, never leaving "as of " dangling', () => {
    expect(COPY.deploy.states.ready_stale('')).toBe('Ready to deploy');
    expect(COPY.deploy.blockedStaleBehindGame('')).toBe('Deploy unavailable');
    expect(COPY.deploy.staleAsOf('')).toBe(COPY.deploy.refreshFailed);
    expect(COPY.deploy.refreshing('')).toBe('Refreshing');
    // Reachable: a stale clear list whose last success has no recorded time.
    const d = deployDisplay({ displayState: 'ready_stale', canStart: true, freshness: { asOf: null, stale: true } });
    expect(d.status).toBe('Ready to deploy');
    expect(`${d.status} ${d.stripLine1} ${d.cardLine.text}`).not.toMatch(/as of\s*$|as of\s+·/);
  });

  it('A5-15: the status dot per state — copper for a failed or uncertain attempt, teal for an existing one, ink-2 while checking', () => {
    expect(deployDisplay({ displayState: 'failed' }).dot).toBe('copper');
    expect(deployDisplay({ displayState: 'uncertain' }).dot).toBe('copper');
    expect(deployDisplay({ displayState: 'existing' }).dot).toBe('teal');
    for (const displayState of ['checking', 'loading_agent', 'account_transition']) expect(deployDisplay({ displayState }).dot, displayState).toBe('ink-2');
    for (const displayState of ['verifying', 'finishing']) expect(deployDisplay({ displayState }).dot, displayState).toBe('blue-action');
    for (const displayState of ['signed_out', 'no_agent', 'agent_error', 'eligibility_error', 'blocked']) expect(deployDisplay({ displayState }).dot, displayState).toBe('ink-3');
  });

  it('A5-15: the build\'s own words and icons — the agent\'s error, the card\'s submitting line, no_agent\'s info icon', () => {
    expect(COPY.deploy.states.agent_error).toBe('Agent unavailable');
    expect(COPY.deploy.cardSubmitting).toBe('Submitting once · waiting for the game to be created');
    expect(deployDisplay({ displayState: 'no_agent' }).cardLine).toEqual({ icon: 'info', text: 'Create your agent first', action: null });
    expect(deployDisplay({ displayState: 'cooldown', cooldownUntil: T }).cardLine.icon).toBe('lock');
  });
});

describe('the status words are phase words: no percentage anywhere (spec §5.5, §10)', () => {
  it('no state string, strip line, card line or note carries a percent', () => {
    for (const state of DEPLOY_DISPLAY_STATES) {
      for (const live of [null, LIVE]) {
        const d = deployDisplay({ displayState: state, canStart: true, reason: 'x', cooldownUntil: T, freshness: { asOf: T, stale: true, refreshing: true }, action: 'retry' }, live);
        expect(`${d.status} ${d.stripLine1} ${d.stripLine2(LOADOUT)} ${d.cardLine?.text ?? ''} ${d.cardNote?.text ?? ''}`).not.toMatch(/%|\d+\s*percent/i);
      }
    }
    expect(`${COPY.shadow.statusIdle} ${COPY.shadow.statusSubmitting}`).not.toMatch(/%/);
  });
});
