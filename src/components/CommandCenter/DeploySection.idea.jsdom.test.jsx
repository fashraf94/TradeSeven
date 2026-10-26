// @vitest-environment jsdom
//
// Command Center hub, slice S6 (ruling R-S6-5; review H-5) — the Deploy card's "Deploying with" line is the NEXT deploy's: drawn
// where a deploy can be started (ready, ready_stale) on the desktop card and on the phone's Loadout-tab card, and in no other
// display state — a running battle froze its own version, a refusal started nothing, a block starts nothing. The line's words are
// COPY.deploy.deployingWith over the Loadout card's own count (COPY.loadout.names).

import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEPLOY_DISPLAY_STATES } from './hub/deployDisplay';
import { HUB_COPY as COPY } from './hub/hubCopy';
import DeploySection, { PhoneDeployCard } from './sections/DeploySection';
import { byRole, injectTokens, mount } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let removeTokens;
let mounted = [];
beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; });

const deployIn = (displayState) => ({
  displayState, canStart: displayState === 'ready' || displayState === 'ready_stale', gateBlocked: false,
  freshness: { asOf: 1, stale: displayState === 'ready_stale', refreshing: false }, retryAction: null, reason: null, action: null, recovered: false,
  battleId: null, cooldownUntil: null, holdControlId: null, retryBlock: null,
});
const IDEA = Object.freeze({ statement: 'Semis lead for ten sessions.', count: 3, version: 2 });
const line = (scope) => scope.querySelector('[data-hub-deploying-with]');

describe('"Deploying with" is drawn where a deploy can be started, and only there', () => {
  it('the states the display table knows include the two that start a deploy', () => {
    expect(DEPLOY_DISPLAY_STATES).toEqual(expect.arrayContaining(['ready', 'ready_stale', 'existing', 'confirmed', 'failed', 'uncertain', 'blocked', 'cooldown', 'checking']));
  });

  it.each(DEPLOY_DISPLAY_STATES)('%s · the desktop card and the phone card draw the line exactly when a deploy can be started', (state) => {
    const startable = state === 'ready' || state === 'ready_stale';
    const desktop = mount(<DeploySection deploy={deployIn(state)} loadoutLine="Archetype · Watchlist" idea={IDEA} />);
    mounted.push(desktop);
    const phone = mount(<PhoneDeployCard deploy={deployIn(state)} idea={IDEA} />);
    mounted.push(phone);
    for (const host of [desktop.host, phone.host]) {
      const drawn = line(host);
      expect(drawn !== null, `${state}: ${host === desktop.host ? 'desktop' : 'phone'}`).toBe(startable);
      if (startable) expect(drawn.textContent).toBe(COPY.deploy.deployingWith(IDEA.statement, COPY.loadout.names(IDEA.count)));
    }
  });

  it('on the desktop card the line stands between the loadout line and the hold, not below the state lines', () => {
    const card = mount(<DeploySection deploy={deployIn('ready')} loadoutLine="Archetype · Watchlist" idea={IDEA} />);
    mounted.push(card);
    const drawn = line(card.host);
    const hold = byRole(card.host, 'button', COPY.deploy.holdLabel)[0];
    expect(drawn.compareDocumentPosition(hold) & Node.DOCUMENT_POSITION_FOLLOWING, 'the line comes before the hold').toBeTruthy();
    const stateLine = card.host.querySelector('[data-hub-hold-help]');
    expect(drawn.compareDocumentPosition(stateLine) & Node.DOCUMENT_POSITION_FOLLOWING, 'and before the helper lines').toBeTruthy();
  });

  it('no idea → no line, in any state; the whole statement is in the line\'s title, and the count wording is the Loadout card\'s', () => {
    const none = mount(<DeploySection deploy={deployIn('ready')} loadoutLine="x" idea={null} />);
    mounted.push(none);
    expect(line(none.host)).toBeNull();
    const withIdea = mount(<DeploySection deploy={deployIn('ready')} loadoutLine="x" idea={{ statement: 'S', count: 1 }} />);
    mounted.push(withIdea);
    expect(line(withIdea.host).textContent).toBe('Deploying with: S · 1 name');
    expect(line(withIdea.host).getAttribute('title')).toBe('Deploying with: S · 1 name');
  });
});
