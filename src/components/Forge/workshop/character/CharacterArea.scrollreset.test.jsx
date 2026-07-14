// @vitest-environment jsdom
//
// Root-cause regression for "Explore won't scroll" (the stateful bug the static
// render smoke could never catch): both sub-views SHARE one scroll owner (the
// CharacterArea root, which lives outside the sub ternary), so switching tabs keeps
// its scrollTop. Scroll the tall "Your Character" down, switch to the shorter
// "Explore", and the owner stays clamped near the bottom — Explore then reads as
// "won't scroll," its top content stranded above the fold. The fix resets the
// owner's scrollTop to 0 on every view change. This test mounts the REAL component,
// scrolls the owner, switches tabs, and asserts the reset — no browser needed
// (jsdom honors scrollTop as a plain settable property, which is all the fix touches).

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../../../services/agentService.js', () => ({
  equipLean: vi.fn(() => Promise.resolve({})),
  unequipLean: vi.fn(() => Promise.resolve({})),
  setTempoDial: vi.fn(() => Promise.resolve({})),
}));

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ForgeKitProvider } from '../forgeKit.jsx';
import CharacterArea from './CharacterArea.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const agent = {
  id: 'a1', archetype: 'momentum_chaser',
  standingLeans: [{ adjustmentId: 'TF-01', version: 1, equippedAt: 't' }],
  dials: { tempo: 'standard' },
};

let container; let root;
afterEach(() => {
  if (root) act(() => root.unmount());
  if (container) container.remove();
  container = null; root = null;
});

const mount = async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(
      <ForgeKitProvider tokens={{}}>
        <CharacterArea agent={agent} agentName="Vera" traits={{ equippedTraits: [] }} twoCol showToast={() => {}} />
      </ForgeKitProvider>,
    );
  });
};

const owner = () => [...container.querySelectorAll('.fw-scroll')].find((el) => el.style.overflowY === 'auto');
const tab = (label) => [...container.querySelectorAll('button')].find((b) => (b.textContent || '').includes(label));
const clickTab = async (label) => { await act(async () => { tab(label).dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };

describe('CharacterArea — the shared scroll owner resets on sub-view switch (Explore can never open pinned to the bottom)', () => {
  it('scrolling Your Character down then switching to Explore resets scrollTop to the top', async () => {
    await mount();
    const el = owner();
    expect(el).toBeTruthy();
    // simulate the user having scrolled the tall Your Character view down
    el.scrollTop = 600;
    expect(el.scrollTop).toBe(600);

    await clickTab('Explore');
    // same DOM node (owner persists across the switch) — must be reset to the top
    expect(owner()).toBe(el);
    expect(el.scrollTop).toBe(0);
    // and Explore actually rendered (below-the-fold content is now reachable from top)
    expect(container.textContent).toMatch(/viewing/i);
  });

  it('switching back to Your Character also opens at the top', async () => {
    await mount();
    await clickTab('Explore');
    const el = owner();
    el.scrollTop = 450;
    await clickTab('Your Character');
    expect(owner()).toBe(el);
    expect(el.scrollTop).toBe(0);
    expect(container.textContent).toMatch(/How it decides/i);
  });
});
