// src/components/CommandCenter/panels/LoadoutPanel.layout.test.jsx
//
// Command Center hub, slice S5 — the Loadout panel's layout contract (ruling
// R-S5-8: "the cards sit side by side only when the panel holds both at a
// readable width; otherwise they stack"; "no truncated name or label").
//
// jsdom computes no layout, so these rows pin what the markup CARRIES: one
// grid template for every composition (a CSS-only decision on the panel's own
// width, so a resize remounts nothing), the measured minimum, and wrapping in
// place of ellipsis. The real fit — columns, line counts, clipping — was
// measured in headless Edge at 360, 390, 549, 614, 770, 1060 and 1216 px and is
// in the S5 build report.

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HubLayoutContext } from '../HubParts';
import { LOADOUT_CARD_MIN } from '../hub/hubStyle';
import { FORGE_DOOR, IDEA_LABEL, LOADOUT_STATUS, WATCHLIST_STATE } from '../hub/selectors/loadout';
import LoadoutPanel from './LoadoutPanel';

const noop = () => {};
const loadout = (over = {}) => ({
  status: LOADOUT_STATUS.READY,
  identity: { name: 'A very long agent name that would not fit on one line at all' },
  archetype: { name: 'Fundamental Investor', approach: 'Buys quality companies and lets the fundamentals do the work.' },
  watchlist: {
    state: WATCHLIST_STATE.READY, id: 'wl', name: 'Concentrated semiconductor and AI infrastructure momentum names', symbols: ['NVDA', 'AAPL'], count: 2, idea: IDEA_LABEL.PLAIN,
  },
  adjustments: { equipped: true, name: '2 traits', sub: 'A · B', door: FORGE_DOOR.CHARACTER },
  lockedInGame: false,
  ...over,
});
const render = (composition, props = {}) => renderToStaticMarkup(
  <HubLayoutContext.Provider value={composition}>
    <LoadoutPanel
      loadout={loadout()}
      onOpenRecord={noop}
      onChangeArchetype={noop}
      onChangeWatchlist={noop}
      onChangeAdjustments={noop}
      onOpenForge={noop}
      onOpenForgeLists={noop}
      onOpenForgeCharacter={noop}
      onRetryLists={noop}
      {...props}
    />
  </HubLayoutContext.Provider>,
);

const cardsStyle = (html) => html.match(/data-hub-loadout-cards="" style="([^"]*)"/)?.[1];

describe('the cards\' grid (ruling R-S5-8)', () => {
  it('stacks by the panel\'s OWN width: auto-fit columns of at least the measured minimum', () => {
    expect(cardsStyle(render('desktop'))).toContain(`grid-template-columns:repeat(auto-fit, minmax(${LOADOUT_CARD_MIN}px, 1fr))`);
  });

  it('the minimum is the measured 240 px: the longest display name needs a 233 px card to sit on one line', () => {
    expect(LOADOUT_CARD_MIN).toBe(240);
    // 201 px of "Fundamental Investor" at 20 px bold, plus the card's 16 px padding a side.
    expect(LOADOUT_CARD_MIN).toBeGreaterThanOrEqual(201 + 32);
  });

  it('is ONE template for every composition, so a width change within a site changes only CSS and remounts nothing', () => {
    const styles = ['phone', 'desktop', 'tablet', 'stacked'].map((c) => cardsStyle(render(c)));
    expect(new Set(styles).size).toBe(1);
  });
});

describe('names and labels wrap — nothing is ellipsized (ruling R-S5-8: no truncated name or label)', () => {
  it('no text-overflow anywhere in the panel, in any state', () => {
    for (const state of Object.values(WATCHLIST_STATE)) {
      const html = render('stacked', { loadout: loadout({ watchlist: { state, id: 'wl', name: 'A long list name', symbols: ['A'], count: 1, idea: IDEA_LABEL.NEUTRAL } }) });
      expect(html, state).not.toContain('text-overflow');
      expect(html, state).not.toContain('ellipsis');
    }
    expect(render('phone', { loadout: { status: LOADOUT_STATUS.LOADING } })).not.toContain('text-overflow');
    expect(render('phone', { loadout: { status: LOADOUT_STATUS.NONE } })).not.toContain('text-overflow');
  });

  it('the long names break where they must instead of clipping: the agent, the archetype, the list, a chip and the adjustments each carry overflow-wrap: anywhere', () => {
    const html = render('phone');
    for (const text of ['A very long agent name that would not fit on one line at all', 'Fundamental Investor', 'Concentrated semiconductor and AI infrastructure momentum names', 'NVDA', '2 traits']) {
      const at = html.indexOf(`>${text}<`);
      expect(at, text).toBeGreaterThan(-1);
      expect(html.slice(html.lastIndexOf('<', at), at), text).toContain('overflow-wrap:anywhere');
    }
  });

  it('the three change buttons wrap their labels (white-space: normal) rather than overflow their card', () => {
    const html = render('phone');
    for (const label of ['Change archetype', 'Change watchlist', 'Change adjustments']) {
      const open = html.indexOf(`>${label}<`);
      expect(open, label).toBeGreaterThan(-1);
      const button = html.slice(html.lastIndexOf('<button', open), open);
      expect(button, label).toContain('white-space:normal');
    }
  });

  it('a card never grows past its column: min-width 0 on the card, so a long unbroken name cannot widen the grid', () => {
    expect(render('desktop')).toMatch(/style="[^"]*min-width:0" data-hub-card="archetype"/);
    expect(render('desktop')).toMatch(/style="[^"]*min-width:0" data-hub-card="watchlist"/);
  });
});

describe('the states the panel draws', () => {
  it('no agent draws the spec\'s words and nothing to press', () => {
    const html = render('desktop', { loadout: { status: LOADOUT_STATUS.NONE } });
    expect(html).toContain('Create your agent first');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('data-hub-card');
  });

  it('the adjustments card is drawn only when the loadout carries one', () => {
    expect(render('desktop')).toContain('data-hub-card="adjustments"');
    expect(render('desktop', { loadout: loadout({ adjustments: null }) })).not.toContain('data-hub-card="adjustments"');
  });

  it('a Forge door with no handler is not drawn (nothing on screen pretends to work)', () => {
    const html = render('desktop', { onOpenForgeLists: undefined, onOpenForgeCharacter: undefined });
    expect(html).not.toContain('Forge Lists');
    expect(html).not.toContain('Forge Character');
  });

  it('the "Forge Traits" name is used while the Character tab is off', () => {
    const html = render('desktop', { loadout: loadout({ adjustments: { equipped: false, name: 'Add traits', sub: 'Optional', door: FORGE_DOOR.TRAITS } }) });
    expect(html).toContain('Forge Traits');
    expect(html).not.toContain('Forge Character');
  });

  it('a fixture-shaped watchlist (a name and symbols, no state) still draws as a resolved list with the neutral label', () => {
    const html = render('desktop', { loadout: { status: LOADOUT_STATUS.READY, archetype: { name: 'Trend Follower', approach: 'x' }, watchlist: { name: 'Tech Leaders', symbols: ['NVDA', 'AAPL', 'MSFT'] }, lockedInGame: false } });
    expect(html).toContain('Tech Leaders');
    expect(html).toContain('3 names');
    expect(html).not.toContain('data-hub-loadout-identity');
  });
});
