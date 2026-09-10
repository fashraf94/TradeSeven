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
import { RESEARCH_FAILED_LINE, RESEARCH_UNREACHABLE_LINE } from '../../data/decisionRecord';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

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
const ROSTER = { ...BENCH, rest: ['MPC', 'SLB', 'NVDA'] };
const renderBench = (props) => act(() => root.render(<PaneBench bench={BENCH} {...props} />));
const door = () => container.querySelector('[data-why-showit="MPC"]');
const chip = () => container.querySelector('[data-bench-chip="MPC"]');
const doorError = () => container.querySelector('[data-why-showit-error="MPC"]');
const chipError = () => container.querySelector('[data-bench-showit-error="MPC"]');

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

  it('the exhausted door still RENDERS, and says so in its ACCESSIBLE NAME (review F-8)', () => {
    renderPanel({ onShowIt: () => {}, researchUsed: RESEARCH_CAP });
    expect(door()).toBeTruthy();
    // `title` alone never reaches a keyboard user (a disabled button is out of
    // the tab order), an AT pairing that prefers aria-label, or touch.
    expect(door().getAttribute('aria-label')).toContain('All 3 reads used in this battle.');
    expect(door().getAttribute('title')).toBe('All 3 reads used in this battle.');
    // …and the ENABLED door's name does not carry it.
    renderPanel({ onShowIt: () => {}, researchUsed: 2 });
    expect(door().getAttribute('aria-label')).not.toContain('All 3 reads used');
  });

  it('a tap already IN FLIGHT disables the door — one 2-15 s route, one tap (review F-2)', () => {
    const calls = [];
    renderPanel({ onShowIt: (s) => calls.push(s), researchUsed: 0, researchPending: true });
    expect(door().disabled).toBe(true);
    act(() => door().dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(calls).toEqual([]);
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

  it('the bench chip is disabled while a tap is in flight too', () => {
    const calls = [];
    renderBench({ onShowIt: (s) => calls.push(s), researchUsed: 0, researchPending: true });
    expect(chip().disabled).toBe(true);
    act(() => chip().dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(calls).toEqual([]);
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
    expect(screen).toContain('countResearchUsed(agentBattle?.chatExchanges)');
    // …and it does no work at all while the flag is dark (review D-3).
    expect(screen).toContain('showItOn ? countResearchUsed(agentBattle?.chatExchanges) : 0');
    // …and nothing anywhere holds it in state or moves it by hand.
    expect(screen).not.toMatch(/setResearchUsed|researchUsed\s*\+\s*1|useState\([^)]*researchUsed/);
    for (const rel of ['src/components/Agent/AgentChat.jsx', 'src/components/League/battleArena/useArenaEngine.js']) {
      const src = read(rel);
      expect(src, `${rel} must keep no research count`).not.toMatch(/researchUsed|researchRemaining|setResearchRemaining/);
    }
    // The screen's research state is the in-flight flag and the refused
    // symbol. NEITHER is a count and neither can stand in for one (review
    // C-3 / F-2, and the refusal section at the bottom of this file).
    expect(screen).toContain('const [researchPending, setResearchPending] = useState(false)');
    expect(screen).toContain('const [researchError, setResearchError] = useState(null)');
  });

  it('TRIPWIRE: the display function is the ONE source for the door’s integer', () => {
    const copy = read('src/screens/battleView/battleViewCopy.js');
    expect(copy).toMatch(/import \{[^}]*RESEARCH_CAP[^}]*researchDoorOrdinal[^}]*\} from '\.\.\/\.\.\/data\/researchCap'/);
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

// ── THE FAILED TAP (Phase C) ────────────────────────────────────────────────
//
// A failed tap moves NOTHING the doors can see: the count comes from the
// subscribed doc and no card arrived, so the only signal was a button that did
// nothing — indistinguishable from a broken one, which is the reading review
// F-8 removed from the exhausted state. The doors now say so.
//
// TWO SENTENCES, AND WHICH ONE IS AN HONESTY QUESTION (decisionRecord.js
// `researchFailureLine`, the shape `filingFailureLine` uses). An ANSWERED
// refusal proves no card was written and therefore no slot consumed, and the
// line says so. A request that never came back proves only that no read came
// back — the commit may have landed with the reply lost — so that line claims
// nothing about the count in either direction. The screen's half of the split
// is the tripwire at the bottom; the doors are pure and render what they are
// handed.
//
// `researchError` is `{ symbol, answered }`, never a boolean: one failed tap on
// MPC must not put a line beside every name on the bench, or on the next
// piece's panel.
const REFUSED = { symbol: 'MPC', answered: true };
const UNREACHED = { symbol: 'MPC', answered: false };

describe('the doors’ error state — the panel’s door', () => {
  it('renders the refusal line, and its cost clause, beside the door', () => {
    renderPanel({ onShowIt: () => {}, researchUsed: 1, researchError: REFUSED });
    expect(doorError()).toBeTruthy();
    expect(doorError().textContent).toBe(RESEARCH_FAILED_LINE);
    expect(doorError().textContent).toBe('Couldn’t load the card · no use spent');
    // Announced on insertion — it answers a tap the player just made.
    expect(doorError().getAttribute('role')).toBe('alert');
    // The door is unmoved: same integer, still enabled, still the retry.
    expect(door().textContent).toBe('Show it · 2 of 3');
    expect(door().disabled).toBe(false);
  });

  it('a tap that never came back says SO, and says nothing about the count', () => {
    renderPanel({ onShowIt: () => {}, researchUsed: 1, researchError: UNREACHED });
    expect(doorError().textContent).toBe(RESEARCH_UNREACHABLE_LINE);
    expect(doorError().textContent).toBe('That read didn’t come back.');
    // THE WHOLE POINT: no cost clause, in either direction. The commit may have
    // landed with the reply lost, so `no use spent` would be a claim the client
    // cannot be held to — and `one use spent` would be the same claim pointing
    // the other way.
    expect(doorError().textContent).not.toContain('use spent');
    expect(doorError().textContent).not.toMatch(/\buse\b/);
    // …and no retry instruction: the door IS the retry, still enabled beside it.
    expect(doorError().textContent).not.toContain('Try again');
    expect(door().disabled).toBe(false);
    expect(doorError().getAttribute('role')).toBe('alert');
  });

  it('the two sentences are told apart by `answered` ALONE, same symbol, same door', () => {
    // Mutation guard for the gate itself: one field differs between these two
    // renders, and it is the field that decides what the client may claim.
    renderPanel({ onShowIt: () => {}, researchUsed: 1, researchError: REFUSED });
    const refused = doorError().textContent;
    expect(doorError().getAttribute('data-why-showit-answered')).toBe('true');
    renderPanel({ onShowIt: () => {}, researchUsed: 1, researchError: UNREACHED });
    expect(doorError().textContent).not.toBe(refused);
    expect(doorError().getAttribute('data-why-showit-answered')).toBe('false');
  });

  it('is ABSENT with no error, and clears when the next tap clears the prop', () => {
    for (const error of [REFUSED, UNREACHED]) {
      renderPanel({ onShowIt: () => {}, researchUsed: 1, researchError: error });
      expect(doorError()).toBeTruthy();
      // The screen nulls it as the next tap starts; the panel renders that.
      renderPanel({ onShowIt: () => {}, researchUsed: 1, researchError: null });
      expect(doorError()).toBeNull();
      expect(container.textContent).not.toContain('no use spent');
      expect(container.textContent).not.toContain('come back');
    }
  });

  it('belongs to the NAME it was about — another piece’s failure says nothing here', () => {
    for (const answered of [true, false]) {
      renderPanel({ onShowIt: () => {}, researchUsed: 1, researchError: { symbol: 'SLB', answered } });
      expect(doorError()).toBeNull();
      expect(container.textContent).not.toContain('no use spent');
      expect(container.textContent).not.toContain('come back');
    }
  });

  it('cannot appear on the flag-dark page — no door, no failure to report', () => {
    for (const error of [REFUSED, UNREACHED]) {
      renderPanel({ onShowIt: null, researchUsed: 1, researchError: error });
      expect(doorError()).toBeNull();
      expect(container.textContent).not.toContain('no use spent');
      expect(container.textContent).not.toContain('come back');
    }
  });
});

describe('the doors’ error state — the bench chip', () => {
  it('renders the same line, from the same string, beside the chip that failed', () => {
    renderBench({ onShowIt: () => {}, researchUsed: 1, researchError: REFUSED });
    expect(chipError()).toBeTruthy();
    expect(chipError().textContent).toBe(RESEARCH_FAILED_LINE);
    expect(chipError().getAttribute('role')).toBe('alert');
    // The chip stays a chip: the symbol is still its whole visible label.
    expect(chip().textContent).toBe('MPC');
    expect(chip().disabled).toBe(false);
  });

  it('a tap that never came back says SO here too, and claims no count', () => {
    renderBench({ onShowIt: () => {}, researchUsed: 1, researchError: UNREACHED });
    expect(chipError().textContent).toBe(RESEARCH_UNREACHABLE_LINE);
    expect(chipError().textContent).not.toMatch(/\buse\b/);
    expect(chipError().textContent).not.toContain('Try again');
    expect(chip().disabled).toBe(false);
  });

  it('BOTH DOORS SAY ONE THING PER CASE — the chip and the panel cannot drift', () => {
    // The two surfaces read the same function (BUILD_RULES §9). A copy of the
    // sentence on one of them fails here, whichever one it is.
    for (const error of [REFUSED, UNREACHED]) {
      renderBench({ onShowIt: () => {}, researchUsed: 1, researchError: error });
      const onChip = chipError().textContent;
      renderPanel({ onShowIt: () => {}, researchUsed: 1, researchError: error });
      expect(doorError().textContent).toBe(onChip);
    }
  });

  it('ONE chip, not the roster — the other names on the bench say nothing', () => {
    for (const error of [REFUSED, UNREACHED]) {
      renderBench({ bench: ROSTER, onShowIt: () => {}, researchUsed: 1, researchError: error });
      expect(container.querySelectorAll('[data-bench-showit-error]')).toHaveLength(1);
      expect(chipError()).toBeTruthy();
      expect(container.querySelector('[data-bench-showit-error="SLB"]')).toBeNull();
      expect(container.querySelector('[data-bench-showit-error="NVDA"]')).toBeNull();
    }
  });

  it('NO FAILURE, NO WRAPPER — the chip is byte-identical to its no-error render', () => {
    renderBench({ onShowIt: () => {}, researchUsed: 1 });
    const clean = container.innerHTML;
    renderBench({ onShowIt: () => {}, researchUsed: 1, researchError: null });
    expect(container.innerHTML).toBe(clean);
    renderBench({ onShowIt: () => {}, researchUsed: 1, researchError: { symbol: 'SLB', answered: true } });
    expect(container.innerHTML).toBe(clean);
    // …and the wrapper DOES appear once there is something to stack beside it,
    // so the comparison above is not passing on a component that never renders
    // the line at all — for either sentence.
    for (const error of [REFUSED, UNREACHED]) {
      renderBench({ onShowIt: () => {}, researchUsed: 1, researchError: error });
      expect(container.innerHTML).not.toBe(clean);
    }
  });

  it('the flag-dark span carries no failure either', () => {
    for (const error of [REFUSED, UNREACHED]) {
      renderBench({ researchError: error });
      expect(chip().tagName).toBe('SPAN');
      expect(chipError()).toBeNull();
    }
  });
});

describe('one sentence, two surfaces (BUILD_RULES §9)', () => {
  it('the chat chip\'s line is the door\'s sentence plus the CHAT\'s own clause', () => {
    // The sentence moved to decisionRecord.js so it has one home. This row is
    // what makes that safe: the shipped chat string is pinned BYTE FOR BYTE, so
    // an edit to the shared sentence that would have silently rewritten the
    // composer's error fails here instead.
    expect(COPY.showItFailed).toBe('That read didn’t come back. Try again.');
    expect(COPY.showItFailed).toBe(`${RESEARCH_UNREACHABLE_LINE} Try again.`);
    // `Try again.` is the CHAT's, and only the chat's: its error sits in the
    // composer's slot, where the retry is a thing the player must be told how
    // to reach. The door is the retry.
    expect(COPY.showItDoorFailed(false)).toBe(RESEARCH_UNREACHABLE_LINE);
    expect(COPY.showItDoorFailed(false)).not.toContain('Try again');
  });

  it('the selector is the ONE place that decides which sentence a door may say', () => {
    expect(COPY.showItDoorFailed(true)).toBe(RESEARCH_FAILED_LINE);
    expect(COPY.showItDoorFailed(false)).toBe(RESEARCH_UNREACHABLE_LINE);
    // Only an ANSWERED failure carries a claim about the count.
    expect(COPY.showItDoorFailed(true)).toContain('no use spent');
    expect(COPY.showItDoorFailed(false)).not.toMatch(/\buse\b/);
    // Anything that is not a proven answer takes the claimless line — the
    // gate fails CLOSED, which is the direction honesty needs it to fail.
    for (const notAnswered of [false, null, undefined, 0, '']) {
      expect(COPY.showItDoorFailed(notAnswered)).toBe(RESEARCH_UNREACHABLE_LINE);
    }
  });
});

describe('the screen’s half: which sentence is set, and when it clears', () => {
  it('TRIPWIRE: `answered` is TRUE only where a response arrived', () => {
    const screen = read('src/screens/AgentBattleScreen.jsx');
    // The state names the symbol AND what the failure proves.
    expect(screen).toContain('const [researchError, setResearchError] = useState(null)');
    // Cleared as the tap starts — the tap is the retry, so the old line is
    // stale the moment another one begins.
    expect(screen).toMatch(/setResearchPending\(true\);\s*\n\s*setResearchError\(null\);/);
    // The ONLY `answered: true` in the handler is the one guarded by `!res.ok`
    // — i.e. a response object exists. Everything else is `answered: false`.
    expect(screen).toContain("if (!res.ok) setResearchError({ symbol: wanted, answered: true });");
    expect((screen.match(/answered: true/g) || []).length).toBe(1);
    // The catch and the no-user branch both claim nothing about the count.
    expect((screen.match(/setResearchError\(\{ symbol: wanted, answered: false \}\)/g) || []).length).toBe(2);
    // …and the catch is no longer silent: a tap with no answer still reports.
    const handler = screen.slice(screen.indexOf('const handleShowIt'));
    const catchBody = handler.slice(handler.indexOf('} catch'), handler.indexOf('finally'));
    expect(catchBody).toContain('answered: false');
    expect(catchBody).not.toContain('answered: true');
  });

  it('TRIPWIRE: the error is not a second count, and both doors are handed it', () => {
    const screen = read('src/screens/AgentBattleScreen.jsx');
    // It holds a symbol and a boolean, never a number: the door's integer
    // still comes from the subscribed doc alone (the section above).
    expect(screen).not.toMatch(/setResearchError\(\s*\d/);
    expect(screen).not.toMatch(/researchError\s*\+\s*1/);
    // Both surfaces receive it — a door that cannot report its own failure is
    // the state this section exists to remove.
    expect((screen.match(/researchError=\{researchError\}/g) || []).length).toBe(2);
  });
});
