// @vitest-environment jsdom
//
// Command Center hub, slice S3 — the strip's height rule (founder ruling
// R-S3-1 on Q-S2A-2):
//   - the strip's first line clamps at two lines and its second at one
//     (DeployStrip; the clamp itself is pinned in CommandCenterHub.s2a);
//   - the review-due refusal reads "Deployment refused" with Open in the Forge
//     on the strip, and the server's line stays on the card;
//   - the full words stay on the Deploy card: on the phone, the Loadout tab's
//     card (PhoneDeployCard), which the strip's status button opens.
// The height each display state reaches at 360 px is measured in headless Edge
// and recorded in the S3 build report; jsdom draws no boxes.
// Same harness as CommandCenterHub.s2a.jsdom.test.jsx.

import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState } = vi.hoisted(() => ({ userState: { user: { displayName: 'Flash', username: 'flash' } } }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
// Slice S3: the hub module now imports its readers, which import the Firebase config; nothing here reads.
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { deployDisplay } from './hub/deployDisplay';
import { deriveHubDeployState } from './hub/selectors/deployState';
import { DUE_DEPLOY_LINE } from '../../constants/hypothesisRecords';
import { DEPLOY_BLOCK_REASON } from '../../utils/commandCenterLiveBattles';
import { HUB_LAYOUT_FIXTURES } from './__fixtures__/hubLayoutFixtures';
import { attemptFor, base } from './__fixtures__/deployStateFixtures';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

function renderPhone(sections, width = 360) {
  layout.state.hubWidth = width;
  const m = mount(<CommandCenterHub site="mobile" sections={sections} />);
  mounted.push(m);
  return m;
}
const strip = () => document.querySelector('[data-hub-strip]');
const phoneCard = () => document.querySelector('[data-hub-deploy-card="phone"]');
const reviewDue = () => deriveHubDeployState(base({ attempt: attemptFor('refused', { result: { kind: 'review_due', line: DUE_DEPLOY_LINE } }) }));
const withDeploy = (deploy) => ({ ...HUB_LAYOUT_FIXTURES.returning.sections, deploy });
const openLoadoutFromStrip = () => {
  const status = byRole(strip(), 'button').find((b) => /Open loadout$/.test(b.getAttribute('aria-label') || ''));
  click(status);
};

describe('the review-due refusal: "Deployment refused" on the strip, the server line on the card', () => {
  it('the display table: refused words on the strip only for the review-due refusal; another refusal keeps its own line', () => {
    const due = deployDisplay({ displayState: 'failed', reason: DUE_DEPLOY_LINE, action: 'openForgeReview' });
    expect(due.stripLine1).toBe(COPY.deploy.reviewDueStrip);
    expect(due.stripLine2('LOADOUT')).toBe('LOADOUT');
    expect(due.strip.action).toEqual({ kind: 'openForgeReview', label: COPY.deploy.openForge });
    expect(due.cardLine.text).toBe(DUE_DEPLOY_LINE);
    // A refusal answered with Retry is not the review-due refusal: its words keep the second line.
    const other = deployDisplay({ displayState: 'failed', reason: 'Please wait between deploys', action: 'retry' });
    expect(other.stripLine1).toBe(COPY.deploy.states.failed);
    expect(other.stripLine2('LOADOUT')).toBe('Please wait between deploys');
    // ...and the review-due words never reach a state that is not a refusal.
    const uncertain = deployDisplay({ displayState: 'uncertain', reason: DUE_DEPLOY_LINE, action: 'openForgeReview' });
    expect(uncertain.stripLine1).toBe(COPY.deploy.states.uncertain);
  });

  it('on the phone: the strip says "Deployment refused" and offers Open in the Forge; the Loadout tab\'s card carries the server\'s line whole', () => {
    renderPhone(withDeploy(reviewDue()));
    expect(strip().querySelector('[data-hub-strip-line="1"]').textContent).toBe(COPY.deploy.reviewDueStrip);
    expect(strip().textContent).not.toContain(DUE_DEPLOY_LINE);
    expect(byRole(strip(), 'button', COPY.deploy.openForge)).toHaveLength(1);
    expect(phoneCard()).toBeNull();
    openLoadoutFromStrip();
    const card = phoneCard();
    expect(card).not.toBeNull();
    expect(card.textContent).toContain(DUE_DEPLOY_LINE);
    const [forge] = byRole(card, 'button', COPY.deploy.openForge);
    expect(forge.disabled).toBe(true);
  });
});

describe('the phone\'s Loadout tab carries the strip\'s full words (PhoneDeployCard)', () => {
  it('a block behind a live game: the strip\'s second line is the clamped reason, the card the whole reason', () => {
    renderPhone(HUB_LAYOUT_FIXTURES.active.sections);
    expect(strip().querySelector('[data-hub-strip-line="2"]').textContent).toBe(`Deploy unavailable · ${DEPLOY_BLOCK_REASON}`);
    openLoadoutFromStrip();
    expect(document.querySelector('[data-hub-phone-panel]').getAttribute('data-hub-phone-panel')).toBe('loadout');
    expect(phoneCard().textContent).toBe(COPY.deploy.states.blocked(DEPLOY_BLOCK_REASON));
  });

  it('a stale block: the card says when it was true and offers the read\'s Retry, disabled with no handler', () => {
    renderPhone(HUB_LAYOUT_FIXTURES.blocked.sections);
    openLoadoutFromStrip();
    const note = phoneCard().querySelector('[data-hub-deploy-note]');
    expect(note.textContent).toMatch(/^As of \d{1,2}:\d{2} [AP]M ET · couldn’t refresh · Retry$/);
    expect(byRole(note, 'button', COPY.deploy.retry)[0].disabled).toBe(true);
  });

  it('a state with no line of its own shows its words, so the card is never empty', () => {
    renderPhone(withDeploy(deriveHubDeployState(base())));
    openLoadoutFromStrip();
    expect(phoneCard().getAttribute('data-hub-deploy')).toBe('ready');
    expect(phoneCard().textContent).toBe(COPY.deploy.states.ready);
  });

  it('holds no hold: the strip keeps the phone\'s one hold control', () => {
    renderPhone(withDeploy(deriveHubDeployState(base())));
    openLoadoutFromStrip();
    expect(byRole(phoneCard(), 'button', COPY.deploy.holdLabel)).toHaveLength(0);
    expect(byRole(document.body, 'button', COPY.deploy.holdLabel)).toHaveLength(1);
  });

  it('only the Loadout tab carries it: Overview, Research and Partnership do not', () => {
    renderPhone(withDeploy(reviewDue()));
    for (const tab of ['overview', 'research', 'partnership']) {
      click(document.querySelector(`[data-hub-phone-tab="${tab}"]`));
      expect(phoneCard(), tab).toBeNull();
    }
    click(document.querySelector('[data-hub-phone-tab="loadout"]'));
    expect(phoneCard()).not.toBeNull();
  });
});
