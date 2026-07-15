// Regression test for the "tab can't scroll" blocker: the ForgeWorkshop body
// slot is overflow:hidden with a fixed height, so the AREA must own its scroll.
// The atom-level render smoke passes whether or not content is REACHABLE — this
// test renders the real CharacterArea and asserts its ROOT is a scroll container
// and that the below-the-fold loadout is present inside it.
//
// agentService is the only firebase-adjacent import in the tree; mocking it lets
// CharacterArea render in the Node test env (everything else is Node-clean).

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../services/agentService.js', () => ({
  equipLean: vi.fn(() => Promise.resolve({})),
  unequipLean: vi.fn(() => Promise.resolve({})),
  setTempoDial: vi.fn(() => Promise.resolve({})),
}));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ForgeKitProvider } from '../forgeKit.jsx';
import CharacterArea from './CharacterArea.jsx';

const agent = {
  id: 'a1',
  archetype: 'momentum_chaser',
  standingLeans: [{ adjustmentId: 'TF-01', version: 1, equippedAt: 't' }],
  dials: { tempo: 'standard' },
};

const render = (twoCol) => renderToStaticMarkup(
  <ForgeKitProvider tokens={{}}>
    <CharacterArea agent={agent} agentName="Vera" traits={{ equippedTraits: [] }} twoCol={twoCol} showToast={() => {}} />
  </ForgeKitProvider>
);

describe('CharacterArea — the tab must own its scroll (regression: content below the fold was unreachable)', () => {
  for (const [label, twoCol] of [['desktop', true], ['mobile', false]]) {
    it(`${label}: the ROOT element is a scroll container (height:100% + overflow-y:auto)`, () => {
      const html = render(twoCol);
      const rootTag = html.slice(0, html.indexOf('>') + 1);
      // The outermost element must be the fw-scroll container that owns the scroll,
      // NOT a bare div (which the parent's overflow:hidden would clip).
      expect(rootTag).toContain('class="fw-scroll"');
      expect(rootTag).toContain('height:100%');
      expect(rootTag).toContain('overflow-y:auto');
      expect(rootTag).not.toContain('overflow:hidden');
    });

    it(`${label}: the below-the-fold loadout (leans menu, tempo dial, fingerprint) is present inside the scroller`, () => {
      const html = render(twoCol);
      expect(html).toContain('Standing leans'); // the loadout column
      expect(html).toContain('Tempo');          // the dial
      expect(html).toContain('Behavior fingerprint');
      expect(html).toContain('TF-01');          // an equipped lean, below the identity header
    });
  }

  it('Explore surfaces the browsed archetype\'s lean menu READ-ONLY — verbatim directives, no Equip', () => {
    const html = renderToStaticMarkup(
      <ForgeKitProvider tokens={{}}>
        <CharacterArea agent={agent} agentName="Vera" traits={{ equippedTraits: [] }} twoCol initialSub="explore" showToast={() => {}} />
      </ForgeKitProvider>,
    );
    expect(html).toContain('What it can be tuned toward');                                  // the read-only menu section
    expect(html).toContain('Prefer fresh breakouts over extended / late-stage entries');    // TF-01 directive, verbatim
    expect(html).toContain('Fresh Breakouts');                                              // its human displayName
    expect(html).not.toContain('Equip</button>');  // view-only: no equip affordance anywhere in Explore
    expect(html).not.toContain('Slots full');
  });
});
