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
// EVERY CHIP SITE, AND NAMES THAT OVERLAP AS SUBSTRINGS (§2 review, C5/C9).
// `PaneBench` renders chips in three places — on the sentences the check spoke
// them in, in the `Flagged` group, and in the roster row — and every fixture
// here used to populate only `rest`, so a defect that dropped the door from the
// first two was invisible. `MP` beside `MPC` is the other half: with three
// names sharing no substring, a match written `includes` instead of `===`
// passed everything.
const ROSTER = {
  slotIso: '2026-09-09T16:15:00.000Z',
  cards: [{ text: 'MPC is holding its base.', symbols: ['MPC'] }],
  flagged: ['SLB'],
  rest: ['MP', 'NVDA'],
  watchlistName: null,
  footer: 'The agent’s own words',
};
/** One name on TWO sentences — what `selectBench` emits for a rationale that
 *  mentions it twice, and the shape no fixture here could reach before. */
const TWICE_NAMED = {
  ...ROSTER,
  cards: [
    { text: 'MPC is holding its base.', symbols: ['MPC'] },
    { text: 'MPC and NVDA both look extended.', symbols: ['MPC', 'NVDA'] },
  ],
  flagged: [],
  rest: [],
};
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

// The two TRIPWIRE rows that stood here moved to the bottom of this file,
// beside the note recording what a source grep can and cannot prove.
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
// `researchError` is `{ symbol, attested }`, never a boolean: one failed tap on
// MPC must not put a line beside every name on the bench, or on the next
// piece's panel.
const ATTESTED = { symbol: 'MPC', attested: true };
const UNATTESTED = { symbol: 'MPC', attested: false };

describe('the doors’ error state — the panel’s door', () => {
  it('renders the refusal line, and its cost clause, beside the door', () => {
    renderPanel({ onShowIt: () => {}, researchUsed: 1, researchError: ATTESTED });
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
    renderPanel({ onShowIt: () => {}, researchUsed: 1, researchError: UNATTESTED });
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

  it('the two sentences are told apart by `attested` ALONE, same symbol, same door', () => {
    // Mutation guard for the gate itself: one field differs between these two
    // renders, and it is the field that decides what the client may claim.
    renderPanel({ onShowIt: () => {}, researchUsed: 1, researchError: ATTESTED });
    const refused = doorError().textContent;
    expect(doorError().getAttribute('data-why-showit-attested')).toBe('true');
    renderPanel({ onShowIt: () => {}, researchUsed: 1, researchError: UNATTESTED });
    expect(doorError().textContent).not.toBe(refused);
    expect(doorError().getAttribute('data-why-showit-attested')).toBe('false');
  });

  it('is ABSENT with no error, and clears when the next tap clears the prop', () => {
    for (const error of [ATTESTED, UNATTESTED]) {
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
    for (const attested of [true, false]) {
      renderPanel({ onShowIt: () => {}, researchUsed: 1, researchError: { symbol: 'SLB', attested } });
      expect(doorError()).toBeNull();
      expect(container.textContent).not.toContain('no use spent');
      expect(container.textContent).not.toContain('come back');
    }
  });

  it('cannot appear on the flag-dark page — no door, no failure to report', () => {
    for (const error of [ATTESTED, UNATTESTED]) {
      renderPanel({ onShowIt: null, researchUsed: 1, researchError: error });
      expect(doorError()).toBeNull();
      expect(container.textContent).not.toContain('no use spent');
      expect(container.textContent).not.toContain('come back');
    }
  });
});

describe('the doors’ error state — the bench chip', () => {
  it('renders the same line, from the same string, for the chip that failed', () => {
    renderBench({ onShowIt: () => {}, researchUsed: 1, researchError: ATTESTED });
    expect(chipError()).toBeTruthy();
    expect(chipError().textContent).toBe(RESEARCH_FAILED_LINE);
    expect(chipError().getAttribute('role')).toBe('alert');
    // The chip stays a chip: the symbol is still its whole visible label.
    expect(chip().textContent).toBe('MPC');
    expect(chip().disabled).toBe(false);
  });

  it('a tap that never came back says SO here too, and claims no count', () => {
    renderBench({ onShowIt: () => {}, researchUsed: 1, researchError: UNATTESTED });
    expect(chipError().textContent).toBe(RESEARCH_UNREACHABLE_LINE);
    expect(chipError().textContent).not.toMatch(/\buse\b/);
    expect(chipError().textContent).not.toContain('Try again');
    expect(chip().disabled).toBe(false);
  });

  it('the two sentences are told apart by `attested` here too (§2 review, C8)', () => {
    // The panel's twin was pinned and the bench's was not, so freezing this
    // attribute was silent. Both are pinned now.
    renderBench({ onShowIt: () => {}, researchUsed: 1, researchError: ATTESTED });
    expect(chipError().getAttribute('data-bench-showit-attested')).toBe('true');
    const attested = chipError().textContent;
    renderBench({ onShowIt: () => {}, researchUsed: 1, researchError: UNATTESTED });
    expect(chipError().getAttribute('data-bench-showit-attested')).toBe('false');
    expect(chipError().textContent).not.toBe(attested);
  });

  it('BOTH DOORS SAY ONE THING PER CASE — the chip and the panel cannot drift', () => {
    // The two surfaces read the same function (BUILD_RULES §9). A copy of the
    // sentence on one of them fails here, whichever one it is.
    for (const error of [ATTESTED, UNATTESTED]) {
      renderBench({ onShowIt: () => {}, researchUsed: 1, researchError: error });
      const onChip = chipError().textContent;
      renderPanel({ onShowIt: () => {}, researchUsed: 1, researchError: error });
      expect(doorError().textContent).toBe(onChip);
    }
  });

  // ── The shapes the old fixtures could not reach (§2 review, A3/B3, B5, C5) ─

  it('ONE LINE for a name the check spoke TWICE — one tap is one alert', () => {
    // `selectBench` emits one card per SENTENCE, so a name mentioned twice
    // renders two chips. The line used to live inside the chip, so one tap
    // printed and announced it twice. It is said once, at the group.
    renderBench({ bench: TWICE_NAMED, onShowIt: () => {}, researchUsed: 1, researchError: ATTESTED });
    expect(container.querySelectorAll('[data-bench-chip="MPC"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-bench-showit-error]')).toHaveLength(1);
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(1);
    // …and BOTH chips point at that one line, so either one a keyboard user
    // lands on describes the failure.
    for (const el of container.querySelectorAll('[data-bench-chip="MPC"]')) {
      expect(el.getAttribute('aria-describedby')).toBe(chipError().getAttribute('id'));
    }
  });

  it('a FLAGGED name keeps its badge — the line is not spliced through it', () => {
    // The failure wrapper used to sit between the symbol and its `Flagged`
    // badge, so the group read `MPC <failure> Flagged`.
    const flaggedFail = { symbol: 'SLB', attested: true };
    renderBench({ bench: ROSTER, onShowIt: () => {}, researchUsed: 1, researchError: flaggedFail });
    const group = container.querySelector('[data-bench-flagged="1"]');
    expect(group.textContent).toBe('SLBFlagged');
    // The line is in the group, after it — never inside the name's own unit.
    const err = container.querySelector('[data-bench-showit-error="SLB"]');
    expect(err).toBeTruthy();
    expect(group.contains(err)).toBe(false);
  });

  it('EVERY chip site carries the door, not just the roster (§2 review, C5)', () => {
    // Sentence-card chips, flagged chips and roster chips all take the same
    // door props; every fixture here used to populate `rest` alone.
    renderBench({ bench: ROSTER, onShowIt: () => {}, researchUsed: 1 });
    for (const symbol of ['MPC', 'SLB', 'MP', 'NVDA']) {
      const el = container.querySelector(`[data-bench-chip="${symbol}"]`);
      expect(el, `a chip for ${symbol}`).toBeTruthy();
      expect(el.getAttribute('data-bench-chip-door'), `${symbol} is a door`).toBe('showit');
    }
    // …and a failure on the sentence-card name lands in the named group.
    renderBench({ bench: ROSTER, onShowIt: () => {}, researchUsed: 1, researchError: ATTESTED });
    expect(container.querySelectorAll('[data-bench-showit-error]')).toHaveLength(1);
  });

  it('the match is IDENTITY, not a substring — BOTH directions (§2 review, C9)', () => {
    // `MP` and `MPC` share a prefix, which `ROSTER` exists to provide: with
    // three names sharing no substring, a match written `includes` passed
    // everything. Both orderings are checked, because only one of them is the
    // dangerous one and a row that tests the safe one proves nothing.
    //
    // The failure is on MPC: a chip named MP must not light.
    renderBench({ bench: ROSTER, onShowIt: () => {}, researchUsed: 1, researchError: ATTESTED });
    expect(container.querySelector('[data-bench-chip="MPC"]').getAttribute('aria-describedby')).toBeTruthy();
    expect(container.querySelector('[data-bench-chip="MP"]').getAttribute('aria-describedby')).toBeNull();
    // …and the failure on MP: a chip named MPC must not light.
    renderBench({ bench: ROSTER, onShowIt: () => {}, researchUsed: 1, researchError: { symbol: 'MP', attested: true } });
    expect(container.querySelector('[data-bench-chip="MP"]').getAttribute('aria-describedby')).toBeTruthy();
    expect(container.querySelector('[data-bench-chip="MPC"]').getAttribute('aria-describedby')).toBeNull();
    expect(container.querySelector('[data-bench-showit-error="MP"]')).toBeTruthy();
    expect(container.querySelector('[data-bench-showit-error="MPC"]')).toBeNull();
  });

  it('a name that is not on this bench at all puts no line on it', () => {
    renderBench({ bench: ROSTER, onShowIt: () => {}, researchUsed: 1, researchError: { symbol: 'AAPL', attested: true } });
    expect(container.querySelectorAll('[data-bench-showit-error]')).toHaveLength(0);
  });

  it('THE CHIP IS BYTE-IDENTICAL WITH OR WITHOUT A FAILURE (§2 review, B4/C7)', () => {
    // The old row compared whole-container HTML against itself, so a wrapper
    // on EVERY chip was in both sides and invisible. This compares the CHIP,
    // across the transition that used to swap its element type and drop a
    // keyboard user's focus to <body>.
    renderBench({ onShowIt: () => {}, researchUsed: 1 });
    const clean = chip().outerHTML;
    const node = chip();
    renderBench({ onShowIt: () => {}, researchUsed: 1, researchError: ATTESTED });
    expect(chip()).toBe(node);                          // the same DOM node
    expect(chip().tagName).toBe('BUTTON');
    // Only the describedby pointer differs — the chip gained no wrapper.
    expect(chip().outerHTML.replace(/ aria-describedby="[^"]*"/, '')).toBe(clean);
    expect(chipError()).toBeTruthy();
  });

  it('the flag-dark span carries no failure either', () => {
    for (const error of [ATTESTED, UNATTESTED]) {
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

describe('the screen’s half — now behavioural, not a grep', () => {
  // THE ROWS THAT MATTER MOVED (§2 review, F2). This file renders the two
  // doors directly; it cannot see `handleShowIt`, and the source greps that
  // used to stand in for it were proven worthless — a stray clear in the
  // handler's `finally` and a prop relocated onto an unrelated component were
  // each silent across all 12,266 tests. Both now redden
  // `AgentBattleScreen.showIt.jsdom.test.jsx`, which mounts the screen, taps
  // the doors and stubs the route.
  //
  // What is left here is the one thing a source read is honestly good for: the
  // doors keep no count of their own (Sol C-2's requirement 4).
  it('TRIPWIRE: neither door’s caller keeps a research count', () => {
    const screen = read('src/screens/AgentBattleScreen.jsx');
    // The count is derived, in one place, from the doc the screen subscribes to.
    expect(screen).toContain('countResearchUsed(agentBattle?.chatExchanges)');
    expect(screen).toContain('showItOn ? countResearchUsed(agentBattle?.chatExchanges) : 0');
    expect(screen).not.toMatch(/setResearchUsed|researchUsed\s*\+\s*1|useState\([^)]*researchUsed/);
    // The failure state holds a symbol and a boolean, never a number.
    expect(screen).not.toMatch(/setResearchError\(\s*\d/);
    expect(screen).not.toMatch(/researchError\s*\+\s*1/);
    for (const rel of ['src/components/Agent/AgentChat.jsx', 'src/components/League/battleArena/useArenaEngine.js']) {
      expect(read(rel), `${rel} must keep no research count`).not.toMatch(/researchUsed|researchRemaining|setResearchRemaining/);
    }
  });

  it('TRIPWIRE: the display function is the ONE source for the door’s integer', () => {
    const copy = read('src/screens/battleView/battleViewCopy.js');
    expect(copy).toMatch(/import \{[^}]*RESEARCH_CAP[^}]*researchDoorOrdinal[^}]*\} from '\.\.\/\.\.\/data\/researchCap'/);
    // No hand-written ratio anywhere in the copy module's CODE. Line comments
    // are stripped first — the section's own docstring quotes the door's shape
    // to explain it, which is documentation, not a second source.
    const code = copy.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/Show it · \d+ of \d+/);
    expect(researchDoorOrdinal(0)).toBe(1);
    expect(researchDoorEnabled(RESEARCH_CAP)).toBe(false);
  });
});
