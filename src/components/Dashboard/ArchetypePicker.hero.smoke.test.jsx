// src/components/Dashboard/ArchetypePicker.hero.smoke.test.jsx
//
// Render smoke for the Agent Presence archetype-picker hero cards (Placement 3).
// Follows the repo convention (react-dom/server, no DOM — effects / rAF / matchMedia
// never run): enough to catch a throw-on-mount and assert the surface composed, which
// build + lint cannot.
//   • hero=true  → the card takes the archetype's own gradient AND mounts a head (face SVG);
//   • hero=false → the plain text card, NO gradient / NO SVG (the byte-identical flag-off path).
//
// The six-distinct disposition mapping the heads read is locked in presenceBinding.test.js;
// the shared-rAF loop (FACE_REG, N heads → one loop) and reduced-motion snap are covered by
// faceEngineCore.test.js + the battle-axis tests. This file guards the picker WIRING: that
// each archetype composes as a hero card and that flag-off stays plain.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

// Mock the live-agent service so importing the picker doesn't pull in the Firebase config
// (this smoke only exercises the presentational ArchetypeCard atom, not the change flow).
vi.mock('../../services/agentService', () => ({ changeArchetype: vi.fn() }));

import { ArchetypeCard, ARCHETYPE_ORDER } from './ArchetypePicker';

const noop = () => {};
const base = { selected: false, busy: false, disabled: false, accent: '#5EEAD4', onClick: noop };

describe('ArchetypePicker hero cards render smoke', () => {
  it('has the six canonical archetypes in Identity Contract order', () => {
    expect(ARCHETYPE_ORDER).toEqual(['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian']);
  });

  it('every archetype composes as a hero card (gradient card color + head SVG) without throwing', () => {
    for (const codeId of ARCHETYPE_ORDER) {
      const html = renderToString(<ArchetypeCard {...base} codeId={codeId} hero />);
      expect(html).toContain('<svg');            // the head mounted
      expect(html).toContain('linear-gradient'); // the archetype's gradient as card color
    }
  });

  it('the selected hero card composes (Current badge path)', () => {
    const html = renderToString(<ArchetypeCard {...base} codeId="degen" selected hero />);
    expect(html).toContain('<svg');
    expect(html).toContain('Current');
  });

  it('flag-off (hero=false) is the plain text path: NO head SVG, NO gradient', () => {
    for (const codeId of ARCHETYPE_ORDER) {
      const html = renderToString(<ArchetypeCard {...base} codeId={codeId} />);
      expect(html).not.toContain('<svg');         // no face — plain card
      expect(html).not.toContain('linear-gradient'); // no gradient — byte-identical to before
    }
  });
});
