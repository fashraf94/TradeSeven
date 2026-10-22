// @vitest-environment jsdom
//
// Command Center hub, slice S2a — the selector wired into the S1 shell
// (ruling R-S2A-3; prompt §4.5, §5):
//   - production: the hub calls deriveHubDeployState with S2a's unresolved
//     inputs, which read `checking`, so nothing a user sees changes;
//   - the layout fixtures: every scenario's deploy state is PRODUCED by the
//     selector from its own inputs, none written by hand;
//   - the new display states through the real strip and Deploy card: each
//     state's words, its one action (disabled with no handler), the freshness
//     note, and `onAction(kind)` once a handler is given.
// Same harness as CommandCenterHub.jsdom.test.jsx.

import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState } = vi.hoisted(() => ({ userState: { user: { displayName: 'Flash', username: 'flash' } } }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
// Slice S3: the hub module now imports its readers, which import the Firebase config; nothing here reads.
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));

import CommandCenterHub from './CommandCenterHub';
import DeploySection from './sections/DeploySection';
import DeployStrip from './DeployStrip';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { deployDisplay } from './hub/deployDisplay';
import { HUB_S1_SECTIONS, HUB_S2A_DEPLOY_INPUTS } from './hub/hubModel';
import { deriveHubDeployState, firstDeploymentCandidate } from './hub/selectors/deployState';
import { DUE_DEPLOY_LINE } from '../../constants/hypothesisRecords';
import { DEPLOY_BLOCK_REASON } from '../../utils/commandCenterLiveBattles';
import { FIXTURE_BLOCK_REASON, HUB_LAYOUT_FIXTURES, HUB_LAYOUT_FIXTURE_NAMES } from './__fixtures__/hubLayoutFixtures';
import { BATTLES, attemptFor, base, pollReady } from './__fixtures__/deployStateFixtures';
import { byRole, byText, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const readHub = (rel) => readFileSync(path.join(HERE, rel), 'utf8').replace(/\r\n/g, '\n');

let layout;
let removeTokens;
let removeNav;
let mounted = [];

beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  layout = installFakeLayout();
  removeNav = mountFakeBottomNav();
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  removeNav();
  layout.restore();
});

function render(element, hubWidth = 1216) {
  layout.state.hubWidth = hubWidth;
  const m = mount(element);
  mounted.push(m);
  return m;
}
const card = () => document.querySelector('[data-hub-deploy]');
const strip = () => document.querySelector('[data-hub-strip]');
const withDeploy = (deploy) => ({ ...HUB_LAYOUT_FIXTURES.returning.sections, deploy });

describe('production: the hub calls the selector with S2a\'s unresolved inputs (ruling R-S2A-3)', () => {
  it('the unresolved inputs read `checking`, and nothing can start', () => {
    expect(deriveHubDeployState(HUB_S2A_DEPLOY_INPUTS)).toMatchObject({ displayState: 'checking', canStart: false, gateBlocked: null, action: null });
  });

  it('every reader is loading with no owner, and there is no identity, attempt, hold, cooldown or clock', () => {
    const i = HUB_S2A_DEPLOY_INPUTS;
    expect(i.auth).toBeNull();
    for (const reader of [i.agent, i.poll, i.completed]) expect(reader).toMatchObject({ status: 'loading', ownerUid: null, ownerEpoch: null });
    expect([i.attempt, i.hold, i.cooldown, i.now]).toEqual([null, null, null, null]);
    expect(Object.isFrozen(i)).toBe(true);
  });

  it('both sites render the selector\'s `checking` on the strip and the card, with every control disabled', () => {
    render(<CommandCenterHub site="mobile" />, 390);
    expect(strip().getAttribute('data-hub-strip')).toBe('checking');
    expect(byText(strip(), COPY.deploy.states.checking)).not.toBeNull();
    for (const b of byRole(strip(), 'button').filter((x) => !/Open loadout$/.test(x.getAttribute('aria-label') || ''))) expect(b.disabled).toBe(true);
    for (const m of mounted) m.unmount();
    mounted = [];
    render(<CommandCenterHub site="desktop" />, 1216);
    expect(card().getAttribute('data-hub-deploy')).toBe('checking');
    expect(byText(card(), COPY.deploy.states.checking)).not.toBeNull();
  });

  it('the hub root calls deriveHubDeployState on HUB_S2A_DEPLOY_INPUTS, and HUB_S1_SECTIONS carries no hand-written deploy', () => {
    const code = readHub('CommandCenterHub.jsx');
    expect(code).toContain('const HUB_S2A_DEPLOY = deriveHubDeployState(HUB_S2A_DEPLOY_INPUTS);');
    // Slice S3 adds App's `hub` object (R-S3-10); without it the deploy state is still this one.
    expect(code).toMatch(/export default function CommandCenterHub\(\{ site, sections = HUB_DEFAULT_SECTIONS, hub \}\)/);
    expect(Object.keys(HUB_S1_SECTIONS)).not.toContain('deploy');
  });

  it('a sections prop without a deploy state renders checking (the selector\'s reading of S2a\'s inputs, and the display\'s fail-closed default alike)', () => {
    render(<CommandCenterHub site="desktop" sections={{ ...HUB_S1_SECTIONS }} />);
    expect(card().getAttribute('data-hub-deploy')).toBe('checking');
  });
});

describe('the layout fixtures: every deploy state is the selector\'s, from the scenario\'s own inputs', () => {
  it.each(HUB_LAYOUT_FIXTURE_NAMES)('%s: exposes its selector inputs, and its deploy is exactly the selector\'s on them (the scenario helper overwrites any hand-written one)', (name) => {
    const { deployInputs, sections } = HUB_LAYOUT_FIXTURES[name];
    expect(deployInputs.auth).toMatchObject({ signedIn: true });
    expect(sections.deploy).toEqual(deriveHubDeployState(deployInputs));
  });

  it('each scenario produces the state its layout shows', () => {
    const states = Object.fromEntries(HUB_LAYOUT_FIXTURE_NAMES.map((n) => [n, HUB_LAYOUT_FIXTURES[n].sections.deploy.displayState]));
    expect(states).toEqual({
      returning: 'ready', long: 'ready', first: 'ready', rankedLive: 'ready', active: 'blocked', review: 'ready', blocked: 'blocked', checking: 'checking',
    });
  });

  it('the blocks are the shipped helper\'s reason, never a fixture\'s words; the stale one says when it was true', () => {
    expect(FIXTURE_BLOCK_REASON).toBe(DEPLOY_BLOCK_REASON);
    expect(HUB_LAYOUT_FIXTURES.active.sections.deploy).toMatchObject({ reason: DEPLOY_BLOCK_REASON, freshness: { stale: false } });
    expect(HUB_LAYOUT_FIXTURES.blocked.sections.deploy).toMatchObject({ reason: DEPLOY_BLOCK_REASON, retryAction: 'poll', freshness: { stale: true } });
    expect(HUB_LAYOUT_FIXTURES.blocked.sections.deploy.freshness.asOf).toBe(HUB_LAYOUT_FIXTURES.blocked.deployInputs.poll.lastSuccessfulAt);
  });

  it('the ranked-only live game stays deployable only because its document carries a groupId (concurrency on)', () => {
    const { deployInputs } = HUB_LAYOUT_FIXTURES.rankedLive;
    expect(deployInputs.poll.liveBattles.every((b) => b.groupId)).toBe(true);
    expect(deriveHubDeployState({ ...deployInputs, concurrencyEnabled: false }).displayState).toBe('blocked');
  });

  it('the first-visit scenario is the only one the selector names a first deployment', () => {
    const firsts = HUB_LAYOUT_FIXTURE_NAMES.filter((n) => firstDeploymentCandidate(HUB_LAYOUT_FIXTURES[n].deployInputs));
    expect(firsts).toEqual(['first']);
    expect(HUB_LAYOUT_FIXTURES.first.sections.nextAction.candidate.key).toBe('deploy');
  });

  it('the fixtures module writes no deploy state by hand: no displayState, canStart or reason literal', () => {
    const code = readHub('__fixtures__/hubLayoutFixtures.js');
    expect(code).not.toMatch(/\bdisplayState\s*:/);
    expect(code).not.toMatch(/\bcanStart\s*:/);
    expect(code).not.toMatch(/\breason\s*:/);
    expect(code).not.toMatch(/session not eligible|capacity 1 of 1/);
  });

  it('every live game row a scenario shows has its battle document in the poll, so Games and the gate agree', () => {
    for (const name of HUB_LAYOUT_FIXTURE_NAMES) {
      const { deployInputs, sections } = HUB_LAYOUT_FIXTURES[name];
      const liveRows = sections.games.rows.filter((g) => g.live).map((g) => g.id).sort();
      const docs = (deployInputs.poll.liveBattles || []).map((b) => b.id).sort();
      expect(docs, name).toEqual(liveRows);
    }
  });
});

describe('the new states through the real Deploy card (desktop) and strip (phone)', () => {
  const attempt = (phase, over) => deriveHubDeployState(base({ attempt: attemptFor(phase, over) }));

  it('failed, review due: the P1b line verbatim on the card, "Deployment refused" on the strip (S3 ruling R-S3-1), Open in the Forge disabled', () => {
    const deploy = attempt('refused', { result: { kind: 'review_due', line: DUE_DEPLOY_LINE } });
    render(<CommandCenterHub site="desktop" sections={withDeploy(deploy)} />);
    expect(card().getAttribute('data-hub-deploy')).toBe('failed');
    expect(card().textContent).toContain(DUE_DEPLOY_LINE);
    const [forge] = byRole(card(), 'button', COPY.deploy.openForge);
    expect(forge.disabled).toBe(true);
    for (const m of mounted) m.unmount();
    mounted = [];
    render(<CommandCenterHub site="mobile" sections={withDeploy(deploy)} />, 390);
    expect(strip().querySelector('[data-hub-strip-line="1"]').textContent).toBe(COPY.deploy.reviewDueStrip);
    // The server's line is the card's, never the strip's (R-S3-1): line two is the loadout again.
    expect(strip().textContent).not.toContain(DUE_DEPLOY_LINE);
    expect(strip().querySelector('[data-hub-strip-line="2"]').textContent).toBe('Speculator · High-Beta Ten');
    expect(byRole(strip(), 'button', COPY.deploy.openForge)[0].disabled).toBe(true);
    expect(byRole(strip(), 'button', COPY.deploy.holdLabel)).toHaveLength(0);
  });

  it.each([
    ['uncertain', () => attempt('uncertain', {}), COPY.deploy.states.uncertain, COPY.deploy.checkDeployment],
    ['existing', () => attempt('existing', { result: { kind: 'existing', battleId: 'bt_live' } }), COPY.deploy.states.existing, COPY.deploy.openGame],
    ['confirmed', () => attempt('created', { ceremonyPhase: 'reveal', result: { kind: 'created', battleId: 'bt_1' } }), COPY.deploy.cardConfirmed, COPY.deploy.enterBattle],
    ['eligibility_error', () => deriveHubDeployState(base({ poll: { status: 'error', liveBattles: null, ownerUid: null, ownerEpoch: null } })), COPY.deploy.states.eligibility_error, COPY.deploy.retry],
  ])('%s: its words and its one action, disabled with no handler', (state, make, words, actionLabel) => {
    render(<CommandCenterHub site="desktop" sections={withDeploy(make())} />);
    expect(card().getAttribute('data-hub-deploy')).toBe(state);
    expect(card().textContent).toContain(words);
    const [button] = byRole(card(), 'button', actionLabel);
    expect(button.disabled).toBe(true);
  });

  it('ready_stale: able to start in principle, the as-of words, and the read\'s Retry in the note', () => {
    const deploy = deriveHubDeployState(base({ poll: pollReady([], { status: 'error' }) }));
    render(<CommandCenterHub site="desktop" sections={withDeploy(deploy)} />);
    expect(card().getAttribute('data-hub-deploy')).toBe('ready_stale');
    const note = card().querySelector('[data-hub-deploy-note]');
    expect(note.textContent).toBe(`${COPY.deploy.refreshFailed}${COPY.sep}${COPY.deploy.retry}`);
    expect(card().textContent).toMatch(/Ready to deploy · as of \d{1,2}:\d{2} [AP]M ET/);
  });

  it('the strip\'s first line clamps at two lines and its second at one, with an ellipsis (S3 ruling R-S3-1; measured in headless Edge at 360, S3 report)', () => {
    // A live BaggerBomb game blocks deploy: line two is the long block reason behind the live line.
    render(<CommandCenterHub site="mobile" sections={HUB_LAYOUT_FIXTURES.active.sections} />, 360);
    const line = (n) => strip().querySelector(`[data-hub-strip-line="${n}"]`).style;
    expect(line('1').display).toBe('-webkit-box');
    expect(line('1').webkitLineClamp ?? line('1').WebkitLineClamp).toBe('2');
    expect(line('1').overflow).toBe('hidden');
    expect(line('2').whiteSpace).toBe('nowrap');
    expect(line('2').overflow).toBe('hidden');
    expect(line('2').textOverflow).toBe('ellipsis');
    // The status button's name still carries both lines whole.
    const name = byRole(strip(), 'button').find((b) => /Open loadout$/.test(b.getAttribute('aria-label') || '')).getAttribute('aria-label');
    expect(name).toContain(`Deploy unavailable · ${DEPLOY_BLOCK_REASON.replace(/[.…]+$/, '')}`);
  });

  it('A1-4: on a terminal attempt the card\'s control is named by its phase, never by the hold instruction', () => {
    const deploy = attempt('existing', { result: { kind: 'existing', battleId: 'bt_live' } });
    render(<CommandCenterHub site="desktop" sections={withDeploy(deploy)} />);
    expect(byRole(card(), 'button', COPY.deploy.holdLabel)).toHaveLength(0);
    const [control] = byRole(card(), 'button', COPY.deploy.states.existing);
    expect(control.disabled).toBe(true);
    expect(byRole(card(), 'button', COPY.deploy.openGame)).toHaveLength(1);
  });

  it('A5-10: with a handler, the hold is live only where the selector allowed a start — on the card and on the strip', () => {
    const onDeploy = vi.fn();
    // The hold is named by its instruction while it offers the hold, else by its phase label (HubHold.jsx).
    const nameOf = (label) => ([COPY.deploy.hold, COPY.deploy.holdShort].includes(label) ? COPY.deploy.holdLabel : label);
    const hold = (scope, deploy) => byRole(scope, 'button', nameOf(deployDisplay(deploy).cardHoldLabel))[0];
    const cases = [
      [deriveHubDeployState(base()), false],
      [deriveHubDeployState(base({ poll: pollReady([], { status: 'error' }) })), false],
      [deriveHubDeployState(base({ poll: { status: 'loading', liveBattles: null, ownerUid: null, ownerEpoch: null } })), true],
      [deriveHubDeployState(base({ poll: pollReady([BATTLES.baggerbomb]) })), true],
      [attempt('refused', { result: { kind: 'refused', line: 'no' } }), true],
    ];
    for (const [deploy, disabled] of cases) {
      render(<DeploySection deploy={deploy} loadoutLine="x" onDeploy={onDeploy} />);
      expect(hold(document.body, deploy).disabled, `card ${deploy.displayState}`).toBe(disabled);
      for (const m of mounted) m.unmount();
      mounted = [];
      render(<DeployStrip deploy={deploy} liveGame={null} loadoutLine="x" placement={{ stripBottom: 64, stripPadsSafeArea: false }} onDeploy={onDeploy} />, 390);
      const stripHold = byRole(document.body, 'button').find((b) => b.getAttribute('aria-label') === COPY.deploy.holdLabel);
      if (stripHold) expect(stripHold.disabled, `strip ${deploy.displayState}`).toBe(disabled);
      else expect(disabled, `strip ${deploy.displayState} shows no hold`).toBe(true);
      for (const m of mounted) m.unmount();
      mounted = [];
    }
  });

  it('cooldown: the next permitted deploy time on the strip, the hold disabled', () => {
    const deploy = deriveHubDeployState(base({ cooldown: { ownerUid: 'owner-a', cooldownUntil: Date.UTC(2026, 9, 14, 14, 42, 5) } }));
    render(<CommandCenterHub site="mobile" sections={withDeploy(deploy)} />, 390);
    expect(strip().getAttribute('data-hub-strip')).toBe('cooldown');
    expect(strip().querySelector('[data-hub-strip-line="1"]').textContent).toBe('Next deploy at 10:43 AM ET');
    expect(byRole(strip(), 'button', COPY.deploy.holdLabel)[0].disabled).toBe(true);
  });

  it('with a handler, an action reports its kind — a read\'s Retry and an attempt\'s Retry are different kinds', () => {
    const calls = [];
    const onAction = (kind) => calls.push(kind);
    render(<DeploySection deploy={deriveHubDeployState(base({ poll: { status: 'error', liveBattles: null, ownerUid: null, ownerEpoch: null } }))} loadoutLine="x" onAction={onAction} />);
    click(byRole(document.body, 'button', COPY.deploy.retry)[0]);
    for (const m of mounted) m.unmount();
    mounted = [];
    render(<DeploySection deploy={attempt('refused', { result: { kind: 'refused', line: 'no' } })} loadoutLine="x" onAction={onAction} />);
    click(byRole(document.body, 'button', COPY.deploy.retry)[0]);
    for (const m of mounted) m.unmount();
    mounted = [];
    render(<DeployStrip deploy={attempt('uncertain', {})} liveGame={null} loadoutLine="x" placement={{ stripBottom: 64, stripPadsSafeArea: false }} onAction={onAction} />, 390);
    click(byRole(document.body, 'button', COPY.deploy.checkDeployment)[0]);
    expect(calls).toEqual(['retryRead', 'retry', 'checkDeployment']);
  });
});
