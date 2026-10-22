// @vitest-environment jsdom
//
// Command Center hub, slice S5 — the Forge bridge's targets, against the REAL
// ForgeWorkshop (ruling R-S5-5: "verify the Lists and Character identifiers in
// ForgeWorkshop"; "an intentional target takes priority over the effect's
// overview reset").
//
// App opens the Forge by rendering ForgeWorkshop with `initialArea={forgeInitialView}`
// in the SAME batch that sets showForge; its effect then resets that view to
// 'overview' for the NEXT open. So what must hold is on ForgeWorkshop's side:
//   - it opens on the area it is handed (the ids hubChrome.js names);
//   - it reads that area ONCE, at mount, so the reset arriving as a later prop
//     change moves nothing;
//   - the tab labels are the words the hub's Forge doors carry.
// The area bodies, the hooks and the service are stand-ins that mark themselves.

import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ tokens: {} }) }));
vi.mock('../../hooks/useForge', () => ({ useForge: () => ({ bundles: [], rules: [] }) }));
vi.mock('../../hooks/useTraits', () => ({ useTraits: () => ({ equippedTraits: [] }) }));
vi.mock('../../hooks/useIsMobile', () => ({ default: () => ({ isDesktop: false, width: 390 }) }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists: async () => [] }));
vi.mock('../Forge/workshop/ForgeOverview', () => ({ default: () => <div data-area="overview" /> }));
vi.mock('../Forge/workshop/WatchlistsArea', () => ({ default: () => <div data-area="watchlists" /> }));
vi.mock('../Forge/workshop/RulesArea', () => ({ default: () => <div data-area="rules" /> }));
vi.mock('../Forge/workshop/TraitsArea', () => ({ default: () => <div data-area="traits" data-tab="traits" /> }));
vi.mock('../Forge/workshop/character/CharacterArea', () => ({ default: () => <div data-area="traits" data-tab="character" /> }));
vi.mock('../Forge/workshop/BundleBuildFlow', () => ({ default: () => null }));

import ForgeWorkshop from '../Forge/workshop/ForgeWorkshop';
import { RELEASE3_CHARACTER_TAB_ENABLED } from '../../config/featureFlags';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { FORGE_AREAS } from './hubChrome';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host;
let root;
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

async function mountForge(initialArea) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const render = (area) => act(() => { root.render(<ForgeWorkshop initialArea={area} onClose={() => {}} user={{ uid: 'u' }} agent={{ id: 'a', name: 'Nova' }} />); });
  render(initialArea);
  await flush();
  return { render };
}
const areaShown = () => host.querySelector('[data-area]')?.getAttribute('data-area');

afterEach(() => {
  if (root) act(() => { root.unmount(); });
  host?.remove();
  host = null;
  root = null;
});

describe('ForgeWorkshop opens on the area the bridge names', () => {
  it.each(Object.values(FORGE_AREAS))('initialArea %s mounts that area', async (area) => {
    await mountForge(area);
    expect(areaShown()).toBe(area);
  });

  it('the Lists door lands on the Lists area (id "watchlists"), the Character door on the traits area (id "traits")', async () => {
    await mountForge(FORGE_AREAS.LISTS);
    expect(areaShown()).toBe('watchlists');
    act(() => { root.unmount(); });
    host.remove();
    await mountForge(FORGE_AREAS.CHARACTER);
    expect(areaShown()).toBe('traits');
    expect(host.querySelector('[data-area]').getAttribute('data-tab')).toBe(RELEASE3_CHARACTER_TAB_ENABLED ? 'character' : 'traits');
  });

  it('an area it does not know (the old "discover", say) opens the overview — as today', async () => {
    await mountForge('discover');
    expect(areaShown()).toBe('overview');
  });
});

describe('the target is read ONCE, at mount — App\'s reset to the overview arrives after the Forge is already on it', () => {
  it.each([FORGE_AREAS.LISTS, FORGE_AREAS.CHARACTER, FORGE_AREAS.RULES])('mounted on %s, a later initialArea="overview" moves nothing', async (area) => {
    const { render } = await mountForge(area);
    expect(areaShown()).toBe(area);
    render('overview');
    await flush();
    expect(areaShown()).toBe(area);
    render('watchlists');
    await flush();
    expect(areaShown()).toBe(area);
  });
});

describe('the tabs carry the words the hub\'s Forge doors name (display agreement, BUILD_RULES §9)', () => {
  it('"Lists" is the watchlists tab and the traits tab is "Character" only while its flag is on, else "Traits"', async () => {
    await mountForge('overview');
    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent).join('|');
    expect(labels).toContain('Lists');
    expect(labels).toContain(RELEASE3_CHARACTER_TAB_ENABLED ? 'Character' : 'Traits');
    expect(COPY.loadout.forgeLists.endsWith('Lists')).toBe(true);
    expect(COPY.loadout.forgeCharacter.endsWith('Character')).toBe(true);
    expect(COPY.loadout.forgeTraits.endsWith('Traits')).toBe(true);
  });
});
