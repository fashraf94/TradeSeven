// @vitest-environment jsdom
//
// src/screens/battleView/showItDoor.jsdom.test.jsx
//
// Phase C §4 / V1.1 ruling 2 (D-122) — THE DOOR'S CONTRACT, on both surfaces.
//
// Sol C-2's remaining two required tests:
//   4. no optimistic client increment survives a failed route;
//   5. the exhausted state and the pre-tap `3 of 3` state have an explicit
//      enabled/disabled contract.
//
// (4) is asserted structurally, which is the strongest form it can take here:
// NO CLIENT KEEPS A RESEARCH COUNT AT ALL. Both doors are handed `researchUsed`
// derived from the subscribed battle doc, so there is no local number for a
// failed request to have moved — the tripwire at the bottom reads the two
// callers' source and fails if either ever grows one.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import WhyPanel from './WhyPanel';
import PaneBench from './PaneBench';
import { WHY_KIND } from './selectWhyState';
import { RESEARCH_CAP, researchDoorEnabled, researchDoorOrdinal } from '../../data/researchCap';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const read = (rel) => readFileSync(path.join(REPO, rel), 'utf8');

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

const STATE = { kind: WHY_KIND.ABSENT, label: 'No check yet today', rationale: null };
const renderPanel = (props) => act(() => root.render(
  <WhyPanel symbol="MPC" state={STATE} headingId="h" {...props} />,
));
const BENCH = { slotIso: null, cards: [], flagged: [], rest: ['MPC'], watchlistName: null, footer: null };
const renderBench = (props) => act(() => root.render(<PaneBench bench={BENCH} {...props} />));
const door = () => container.querySelector('[data-why-showit="MPC"]');
const chip = () => container.querySelector('[data-bench-chip="MPC"]');

describe('5. the enabled / disabled contract — the door', () => {
  it('prints the ordinal of the NEXT read and is enabled while one is left', () => {
    for (const used of [0, 1, 2]) {
      renderPanel({ onShowIt: () => {}, researchUsed: used });
      expect(door().textContent).toBe(`Show it · ${used + 1} of ${RESEARCH_CAP}`);
      expect(door().disabled).toBe(false);
    }
  });

  it('the LAST enabled door and the EXHAUSTED door share their text and differ ONLY in `disabled`', () => {
    renderPanel({ onShowIt: () => {}, researchUsed: 2 });
    const enabledText = door().textContent;
    expect(door().disabled).toBe(false);

    renderPanel({ onShowIt: () => {}, researchUsed: 3 });
    expect(door().textContent).toBe(enabledText);   // both read `3 of 3`
    expect(door().textContent).toBe('Show it · 3 of 3');
    expect(door().disabled).toBe(true);
  });

  it('the exhausted door still RENDERS — what a player has spent is a true thing to say', () => {
    renderPanel({ onShowIt: () => {}, researchUsed: RESEARCH_CAP });
    expect(door()).toBeTruthy();
    expect(door().getAttribute('title')).toBe('All 3 reads used in this battle.');
  });

  it('a tap on an exhausted door calls nothing', () => {
    const calls = [];
    renderPanel({ onShowIt: (s) => calls.push(s), researchUsed: RESEARCH_CAP });
    act(() => door().dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(calls).toEqual([]);
  });

  it('an enabled tap hands the route the PIECE’s symbol', () => {
    const calls = [];
    renderPanel({ onShowIt: (s) => calls.push(s), researchUsed: 0 });
    act(() => door().dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(calls).toEqual(['MPC']);
  });

  it('is absent WHOLE without a handler — the flag-dark page is the two-door page', () => {
    renderPanel({ onShowIt: null, researchUsed: 0 });
    expect(door()).toBeNull();
    expect(container.textContent).not.toMatch(/Show it/);
  });

  it('the accessible name says what the control DOES, not just its ratio', () => {
    renderPanel({ onShowIt: () => {}, researchUsed: 1 });
    expect(door().getAttribute('aria-label')).toBe("Show the platform's data on MPC · read 2 of 3");
  });
});

describe('5. the same contract on the bench chip', () => {
  it('is the shipped <span> without a handler, and a button with one', () => {
    renderBench({});
    expect(chip().tagName).toBe('SPAN');
    expect(chip().getAttribute('data-bench-chip-door')).toBeNull();

    renderBench({ onShowIt: () => {}, researchUsed: 0 });
    expect(chip().tagName).toBe('BUTTON');
    expect(chip().disabled).toBe(false);
  });

  it('keeps the SYMBOL as its visible label at every count — a bench is not a row of ratios', () => {
    for (const used of [0, 2, 3]) {
      renderBench({ onShowIt: () => {}, researchUsed: used });
      expect(chip().textContent).toBe('MPC');
    }
  });

  it('is disabled when exhausted, and taps nothing then', () => {
    const calls = [];
    renderBench({ onShowIt: (s) => calls.push(s), researchUsed: RESEARCH_CAP });
    expect(chip().disabled).toBe(true);
    act(() => chip().dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(calls).toEqual([]);

    renderBench({ onShowIt: (s) => calls.push(s), researchUsed: 1 });
    act(() => chip().dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(calls).toEqual(['MPC']);
  });
});

describe('4. no optimistic client increment survives a failed route', () => {
  it('the door renders from the count it is HANDED — it holds no state of its own', () => {
    // Re-rendering with the same count after a failed tap cannot move the door,
    // because the tap wrote nothing anywhere for it to read.
    const calls = [];
    renderPanel({ onShowIt: (s) => calls.push(s), researchUsed: 1 });
    act(() => door().dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => door().dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(calls).toEqual(['MPC', 'MPC']);
    expect(door().textContent).toBe('Show it · 2 of 3');   // unmoved by two taps
  });

  it('TRIPWIRE: neither caller keeps a research count — the number comes from the subscribed doc', () => {
    const screen = read('src/screens/AgentBattleScreen.jsx');
    // The count is derived, in one place, from the doc the screen subscribes to.
    expect(screen).toContain('const researchUsed = countResearchUsed(agentBattle?.chatExchanges)');
    // …and nothing anywhere holds it in state or moves it by hand.
    expect(screen).not.toMatch(/setResearchUsed|researchUsed\s*\+\s*1|useState\([^)]*researchUsed/);
    for (const rel of ['src/components/Agent/AgentChat.jsx', 'src/components/League/battleArena/useArenaEngine.js']) {
      const src = read(rel);
      expect(src, `${rel} must keep no research count`).not.toMatch(/researchUsed|researchRemaining|setResearchRemaining/);
    }
  });

  it('TRIPWIRE: the display function is the ONE source for the door’s integer', () => {
    const copy = read('src/screens/battleView/battleViewCopy.js');
    expect(copy).toContain("import { RESEARCH_CAP, researchDoorOrdinal } from '../../data/researchCap'");
    // No hand-written ratio anywhere in the copy module's CODE. Line comments
    // are stripped first — the section's own docstring quotes the door's shape
    // to explain it, which is documentation, not a second source.
    const code = copy.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/Show it · \d+ of \d+/);
    // And the function itself is what the door prints (mutation-checked: change
    // the ordinal and this row fails).
    expect(researchDoorOrdinal(0)).toBe(1);
    expect(researchDoorEnabled(RESEARCH_CAP)).toBe(false);
  });
});
