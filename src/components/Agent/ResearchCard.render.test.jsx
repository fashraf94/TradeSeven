// @vitest-environment jsdom
//
// src/components/Agent/ResearchCard.render.test.jsx
//
// Phase C §3 (D-119, Sol C-4) — the card on screen.
//
// The two claims worth asserting are provenance claims, and they are asserted
// narrowly, exactly as V1.1 §F narrows them:
//   · the platform-data label is a property of THE CARD, not of a container;
//   · the two data classes never share a section, and each section carries its
//     own provenance.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ResearchCard from './ResearchCard';
import { PLATFORM_DATA_LABEL } from '../../data/decisionRecord';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** The repo's jsdom idiom: render into a real container, then read the DOM. */
const render = (props) => {
  act(() => root.render(<ResearchCard {...props} />));
  return { container };
};
const textOf = () => container.textContent;

const CARD = {
  symbol: 'MPC',
  eyebrow: 'Research',
  platformDataLabel: PLATFORM_DATA_LABEL,
  technicals: { facts: ['RSI 62.4 · neutral', 'ATR 2.14% · normal'], label: 'Technicals · last quote 10:00 AM · daily indicators as of Sep 8' },
  fundamentals: { facts: ['P/E 14.2 · sector median 19.6'], label: 'Fundamentals · as of Sep 5' },
  standing: { place: 'bench', line: 'On the bench', facts: [] },
  equip: false,
};

describe('the card renders what it was handed, and nothing else', () => {
  it('draws the eyebrow, the symbol and every composed fact verbatim', () => {
    render({ card: CARD });
    for (const text of ['Research', 'MPC', 'RSI 62.4 · neutral', 'ATR 2.14% · normal', 'P/E 14.2 · sector median 19.6', 'On the bench']) {
      expect(textOf()).toContain(text);
    }
  });

  it('renders NOTHING without a card', () => {
    render({ card: null });
    expect(container.firstChild).toBeNull();
    render({ card: 'MPC' });
    expect(container.firstChild).toBeNull();
  });
});

describe('the platform-data label travels WITH the card (Sol C-4)', () => {
  it('is inside the card element, not beside it', () => {
    render({ card: CARD });
    const card = container.querySelector('[data-research-card="MPC"]');
    const label = container.querySelector('[data-research-platform-label]');
    expect(card).toBeTruthy();
    expect(label).toBeTruthy();
    expect(card.contains(label)).toBe(true);
    expect(label.textContent).toBe('Platform data · not what the check saw');
  });

  it('the label is the card’s own field — a card without one renders no substitute', () => {
    render({ card: { ...CARD, platformDataLabel: null } });
    expect(container.querySelector('[data-research-platform-label]')).toBeNull();
  });
});

describe('each section carries its own provenance, and the classes never share one (D-119)', () => {
  it('technicals and fundamentals are separate sections with separate labels', () => {
    render({ card: CARD });
    const tech = container.querySelector('[data-research-section="technicals"]');
    const fund = container.querySelector('[data-research-section="fundamentals"]');
    expect(tech.contains(fund)).toBe(false);
    expect(fund.contains(tech)).toBe(false);
    expect(container.querySelector('[data-research-provenance="technicals"]').textContent)
      .toBe('Technicals · last quote 10:00 AM · daily indicators as of Sep 8');
    expect(container.querySelector('[data-research-provenance="fundamentals"]').textContent)
      .toBe('Fundamentals · as of Sep 5');
  });

  it('a section the composer withheld is ABSENT WHOLE — no heading, no placeholder', () => {
    render({ card: { ...CARD, technicals: null } });
    expect(container.querySelector('[data-research-section="technicals"]')).toBeNull();
    expect(container.querySelector('[data-research-section="fundamentals"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(/N\/A|unavailable|—\s*$/);
  });

  it('never renders Phase B’s evidence words — the two vocabularies do not meet here', () => {
    render({ card: CARD });
    expect(container.textContent).not.toMatch(/What this check saw|From the .* check|The agent's own words/);
  });
});

describe('the Equip door (D-54, hazard 7)', () => {
  it('is absent without a handler, even when the card offers it', () => {
    render({ card: { ...CARD, equip: true } });
    expect(container.querySelector('[data-research-equip]')).toBeNull();
  });

  it('is absent when the card does NOT offer it, even with a handler', () => {
    render({ card: { ...CARD, equip: false }, onEquip: () => {} });
    expect(container.querySelector('[data-research-equip]')).toBeNull();
  });

  it('renders, and calls back with the card’s symbol, when both are true', () => {
    const calls = [];
    render({ card: { ...CARD, equip: true }, onEquip: (s) => calls.push(s) });
    const door = container.querySelector('[data-research-equip="MPC"]');
    expect(door.textContent).toBe('Equip');
    act(() => door.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(calls).toEqual(['MPC']);
  });
});
