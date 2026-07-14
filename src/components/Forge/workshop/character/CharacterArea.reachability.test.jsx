// Reachability regression (not just rendering) for the Character tab.
//
// The render smoke proves markup exists; it does NOT prove the markup is
// *reachable* — the "tab can't scroll" blocker rendered every control fine while
// trapping it below the fold. This test renders the REAL CharacterArea in BOTH
// views (Your Character + Explore) at BOTH breakpoints, parses the output with
// jsdom, and walks each interactive control's ancestry up to the scroll owner.
// A control fails if it is not a descendant of the fw-scroll owner, or if any
// ancestor between it and the owner is a height-bounded overflow:hidden box that
// would clip it. This is what would have caught the original bug — and guards
// the Explore view (bug 1) and the restructured loadout (bug 2) going forward.
//
// jsdom parses the SSR string (no DOM env needed); agentService is mocked so the
// firebase-adjacent import stays Node-clean, same as the render smoke.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../services/agentService.js', () => ({
  equipLean: vi.fn(() => Promise.resolve({})),
  unequipLean: vi.fn(() => Promise.resolve({})),
  setTempoDial: vi.fn(() => Promise.resolve({})),
}));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { ForgeKitProvider } from '../forgeKit.jsx';
import CharacterArea from './CharacterArea.jsx';
import { TEMPO_POSITIONS } from '../../../../data/characterLeanPresentation.js';
import { getArchetypeRoster } from '../../../../data/archetypeCharacter.js';

const agent = {
  id: 'a1',
  archetype: 'momentum_chaser',
  standingLeans: [{ adjustmentId: 'TF-01', version: 1, equippedAt: 't' }],
  dials: { tempo: 'standard' },
};

// Render a real CharacterArea (a given view + breakpoint) and return its parsed DOM.
function renderDom({ twoCol, initialSub }) {
  const html = renderToStaticMarkup(
    <ForgeKitProvider tokens={{}}>
      <CharacterArea agent={agent} agentName="Vera" traits={{ equippedTraits: [] }}
        twoCol={twoCol} initialSub={initialSub} showToast={() => {}} />
    </ForgeKitProvider>,
  );
  return new JSDOM(html).window.document;
}

const styleOf = (el) => el.getAttribute('style') || '';

// The vertical scroll owner: the fw-scroll box that actually owns overflow-y.
// (RosterStrip is also fw-scroll but scrolls the *x* axis — exclude it.)
function scrollOwner(doc) {
  return [...doc.querySelectorAll('.fw-scroll')].find((el) => /overflow-y\s*:\s*auto/.test(styleOf(el))) || null;
}

// A box clips vertical content only when overflow is hidden AND the box is
// height-bounded (a bare overflow:hidden on an auto-height block just grows).
function isBoundedClip(el) {
  const s = styleOf(el);
  const clips = /(?:^|;)\s*overflow(?:-y)?\s*:\s*hidden/.test(s);
  if (!clips) return false;
  const withoutMin = s.replace(/min-height\s*:[^;]*/g, '');
  return /(?:^|;)\s*(?:max-)?height\s*:\s*(?!auto)[^;]+/.test(withoutMin);
}

// Walk from a control up to the scroll owner. Reachable = we reach the owner with
// no height-bounded overflow:hidden box in between.
function reachability(el, owner) {
  let cur = el.parentElement;
  while (cur && cur !== owner) {
    if (isBoundedClip(cur)) return { reachable: false, clip: cur };
    cur = cur.parentElement;
  }
  return { reachable: cur === owner, clip: null };
}

const text = (el) => (el.textContent || '').trim();

const BREAKPOINTS = [['desktop', true], ['mobile', false]];

describe('CharacterArea — reachability (every interactive control lives inside the scroll owner)', () => {
  for (const [bp, twoCol] of BREAKPOINTS) {
    // ── Your Character view ────────────────────────────────────────────────
    describe(`Your Character · ${bp}`, () => {
      const doc = renderDom({ twoCol, initialSub: 'character' });
      const owner = scrollOwner(doc);

      it('has a single vertical scroll owner (height:100% + overflow-y:auto), not a bare/clipped root', () => {
        expect(owner).not.toBeNull();
        expect(/height\s*:\s*100%/.test(styleOf(owner))).toBe(true);
        expect(/(?:^|;)\s*overflow\s*:\s*hidden/.test(styleOf(owner))).toBe(false);
        // it must be the outermost element — nothing above it inside the area can clip
        expect(owner).toBe(doc.body.firstElementChild);
      });

      it('EVERY button is reachable — under the scroll owner, no height-bounded clip between', () => {
        const buttons = [...owner.querySelectorAll('button')];
        expect(buttons.length).toBeGreaterThan(0);
        for (const b of buttons) {
          const r = reachability(b, owner);
          expect(r.reachable, `unreachable control "${text(b) || b.getAttribute('title') || '?'}" — clipped by <${r.clip?.tagName?.toLowerCase()} style="${r.clip ? styleOf(r.clip) : ''}">`).toBe(true);
        }
      });

      it('the Equip control (below the identity fold) is present and reachable', () => {
        const equip = [...owner.querySelectorAll('button')].filter((b) => /^(Equip|Slots full|Remove)$/.test(text(b)));
        expect(equip.length).toBeGreaterThan(0);
        for (const b of equip) expect(reachability(b, owner).reachable).toBe(true);
      });

      it('all three tempo dial positions are present and reachable', () => {
        for (const tp of TEMPO_POSITIONS) {
          const btn = [...owner.querySelectorAll('button')].find((b) => text(b) === tp.label);
          expect(btn, `tempo position "${tp.label}" not rendered`).toBeTruthy();
          expect(reachability(btn, owner).reachable).toBe(true);
        }
      });
    });

    // ── Explore view (bug 1 — the "second location") ───────────────────────
    describe(`Explore · ${bp}`, () => {
      const doc = renderDom({ twoCol, initialSub: 'explore' });
      const owner = scrollOwner(doc);

      it('has the same vertical scroll owner — Explore is inside the scroller, not a bare root', () => {
        expect(owner).not.toBeNull();
        expect(/height\s*:\s*100%/.test(styleOf(owner))).toBe(true);
        expect(owner).toBe(doc.body.firstElementChild);
      });

      it('EVERY button is reachable — under the scroll owner, no height-bounded clip between', () => {
        const buttons = [...owner.querySelectorAll('button')];
        expect(buttons.length).toBeGreaterThan(0);
        for (const b of buttons) {
          const r = reachability(b, owner);
          expect(r.reachable, `unreachable control "${text(b) || '?'}" — clipped by <${r.clip?.tagName?.toLowerCase()} style="${r.clip ? styleOf(r.clip) : ''}">`).toBe(true);
        }
      });

      it('the roster switchers are present and reachable (the reader content below them can scroll into view)', () => {
        const firstWords = getArchetypeRoster().map((a) => a.name.split(' ')[0]);
        const rosterBtns = [...owner.querySelectorAll('button')].filter((b) => firstWords.some((w) => text(b).includes(w)));
        expect(rosterBtns.length).toBeGreaterThanOrEqual(2);
        for (const b of rosterBtns) expect(reachability(b, owner).reachable).toBe(true);
      });
    });
  }
});
