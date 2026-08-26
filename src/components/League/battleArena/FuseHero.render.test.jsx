// @vitest-environment jsdom
//
// Phase 3 — FuseHero acceptance rows (renderToString over REAL components; the
// ArenaDesktop.smoke.test.jsx harness). jsdom supplies matchMedia so the
// reduced-motion contract (acceptance 13) is testable both ways.
//
// Trails are built through the REAL Phase 2 accumulator (emptyTrail /
// appendTrailSnapshot), never hand-shaped — the board is tested against the
// data it will actually receive.

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { FuseHero } from './FuseHero';
import { emptyTrail, appendTrailSnapshot } from './useSessionCompositeTrail';
import { FH, fuseFrame, scopeToggleLeft, yGutterWidth, monoWidth } from './fuseGeometry';

const IDS = ['you', 'r1', 'r2', 'r3'];
const SEATS = [
  { id: 'you', name: 'You', kind: 'you', you: true, color: '#5EEAD4', arch: 'Speculator' },
  { id: 'r1', name: 'CPU — Trend', kind: 'cpu', you: false, color: '#B48CDE', arch: undefined },
  { id: 'r2', name: 'Riva', kind: 'human', you: false, color: '#7FB2FF', arch: undefined },
  { id: 'r3', name: 'CPU — Contra', kind: 'cpu', you: false, color: '#E0A46B', arch: undefined },
];
const SEEDS = { you: 10, r1: 10, r2: 10, r3: 10 };
const CLIMB = { you: [10], r1: [10], r2: [10], r3: [10] };
const T = (hhmmZ) => Date.parse(`2026-08-26T${hhmmZ}:00Z`); // EDT: 13:30Z = 9:30 ET open
const NOON = () => T('16:00'); // 12:00 ET

// One live snapshot: you 12 · r1 25 · r2 13 · r3 11 → cut (2nd) = 13,
// needToday = 1, leader r1. Day-scope HI = 15 (r1's +15), so the day cut line
// SHOWS; week-scope HI = 25 keeps the CUT label clear of the top label (the
// greedy thinner correctly drops a CUT that hugs the top — tested in
// fuseGeometry.test.js — so this fixture spreads them).
function liveTrail() {
  const scores = { you: 12, r1: 25, r2: 13, r3: 11 };
  const liveMap = Object.fromEntries(IDS.map((id) => [id, true]));
  return appendTrailSnapshot(emptyTrail({ ...SEEDS }), {
    ids: IDS, scoresAtLast: scores, seatLive: liveMap, t: T('16:00'),
  });
}

const BASE = {
  seats: SEATS, climb: CLIMB, youId: 'you', dayIdx: 0,
  w: 1316, h: 420, nowFn: NOON,
};

function setRM(matches) {
  window.matchMedia = (q) => ({ matches, media: q, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {} });
}
beforeEach(() => setRM(false));

const render = (props) => renderToString(<FuseHero {...BASE} {...props} />);

describe('FuseHero — cut line per mode and scope (acceptance 8 + B2)', () => {
  it('ranked / day: the +N TODAY MAKES THE CUT annotation and the cut group render', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail() });
    expect(html).toContain('TODAY MAKES THE CUT');
    expect(html).toContain('data-fh-cut');
    expect(html).toContain('OPEN');   // day x labels
    expect(html).toContain('CLOSE');
    expect(html).toContain('NOW');    // desktop pill
  });

  it('ranked / week: dashed CUT at the 2nd-place composite, MON–FRI axis', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail(), scope: 'week' });
    expect(html).toContain('data-fh-cut');
    expect(html).toContain('CUT');
    expect(html).not.toContain('MAKES THE CUT'); // the annotation is day-scope only
    for (const d of ['MON', 'TUE', 'WED', 'THU', 'FRI']) expect(html).toContain(d);
  });

  it('training draws NO cut line in either scope', () => {
    for (const scope of ['day', 'week']) {
      const html = render({ state: 'live', mode: 'training', trail: liveTrail(), scope });
      expect(html).not.toContain('data-fh-cut');
      expect(html).not.toContain('CUT');
    }
  });

  it('voided ranked suppresses the cut AND the crown (standings signifiers)', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail(), voided: true });
    expect(html).not.toContain('data-fh-cut');
    expect(html).not.toContain('data-fh-crown');
  });
});

describe('FuseHero — leader crown only, identity never repainted (acceptance 9)', () => {
  it('exactly one crown, on the leader tip; the leader keeps its identity colour', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail() });
    expect(html.split('data-fh-crown').length - 1).toBe(1);
    // the crown sits inside r1's tip block
    const r1Block = html.slice(html.indexOf('data-fh-tip="r1"'), html.indexOf('data-fh-tip="r2"') > -1 ? html.indexOf('data-fh-tip="r2"') : undefined);
    expect(r1Block).toContain('data-fh-crown');
    // the leader's fuse still strokes in its OWN colour (never gold)
    expect(html).toContain('stroke="#B48CDE"');
    // and its value text is its identity colour, not gold
    expect(r1Block).toContain('color:#B48CDE');
  });

  it('a negative running value flips line + value to the kept-negative red — the one exception', () => {
    const scores = { you: 6, r1: 13.5, r2: 13, r3: 11 }; // you −4 on the day
    const liveMap = Object.fromEntries(IDS.map((id) => [id, true]));
    const trail = appendTrailSnapshot(emptyTrail({ ...SEEDS }), { ids: IDS, scoresAtLast: scores, seatLive: liveMap, t: T('16:00') });
    const html = render({ state: 'live', mode: 'ranked', trail });
    expect(html).toContain('stroke="#F2766B"');
    const youBlock = html.slice(html.indexOf('data-fh-tip="you"'));
    expect(youBlock).toContain('color:#F2766B');
    expect(youBlock).toContain('-4.0');
  });

  it('YOU seat: heavier stroke and the YOU sublabel', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail() });
    expect(html).toContain('stroke-width="2.8"');
    expect(html).toContain('stroke-width="2"');
    expect(html).toContain('>YOU<');
  });
});

describe('FuseHero — reload, awaiting, complete states (acceptance 2)', () => {
  it('live with an EMPTY trail: flat spine + live tip, not an empty chart, not a curve', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: emptyTrail({ ...SEEDS }) });
    expect(html).toContain('stroke-dasharray="2 5"');       // the spine treatment
    expect(html).toContain('data-fh-tip="you"');            // tips render
    expect(html).toContain('0.0');                          // the seed value, not blank
  });

  it('awaiting: start line, dead tips, no cut, the bell caption', () => {
    const html = render({ state: 'awaiting', mode: 'ranked', trail: emptyTrail({}) });
    expect(html).toContain('At the start line');
    expect(html).toContain('The fuses light at the bell');
    expect(html).not.toContain('data-fh-cut');
    expect(html).not.toContain('fhEmber');                  // dead tip = static dot
    expect(html).toContain('—');
  });

  it('complete defaults to The Week and burns no ember', () => {
    const html = render({ state: 'complete', mode: 'ranked', trail: emptyTrail({ ...SEEDS }) });
    expect(html).toContain('MON');                          // week axis by default
    expect(html).not.toContain('fhEmber');
    expect(html).not.toContain('fhCreep');
  });
});

describe('FuseHero — TIPROOM keeps the tip inside the hero (acceptance 6)', () => {
  const tipLefts = (html) => {
    const out = [];
    const re = /data-fh-tip="[^"]+" style="[^"]*left:\s*([0-9.]+)px/g;
    let m;
    while ((m = re.exec(html))) out.push(parseFloat(m[1]));
    return out;
  };

  for (const w of [1316, 900, 640]) {
    it(`w=${w}: every tip x ≤ w − padR − TIPROOM`, () => {
      const html = render({ state: 'live', mode: 'ranked', trail: liveTrail(), w });
      const lefts = tipLefts(html);
      expect(lefts.length).toBe(4);
      const plotR = Math.max(FH.desktop.padL + 40, w - FH.desktop.padR - FH.desktop.TIPROOM);
      for (const left of lefts) expect(left).toBeLessThanOrEqual(plotR + 0.01);
    });
  }
});

describe('FuseHero — reduced motion (acceptance 13)', () => {
  it('no ember pulse, no sparks, no creep, no fly, no tape scroll — board still complete', () => {
    setRM(true);
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail(), surge: { key: 1, pts: '+15' } });
    expect(html).not.toMatch(/fhEmber|fhSpark|fhCreep|fhFly|fhHeat/);
    // fully legible with animation off: cut, tips, values, labels all present
    expect(html).toContain('data-fh-cut');
    expect(html).toContain('data-fh-tip="you"');
    expect(html).toContain('TODAY MAKES THE CUT');
  });

  it('with motion allowed, the surge flies its points up (R11 pulse, real-beat-driven)', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail(), surge: { key: 1, pts: '+15' } });
    expect(html).toContain('fhFly');
    expect(html).toContain('+15');
  });
});

describe('FuseHero — scope toggle', () => {
  it('live defaults to Today; the toggle renders both options', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail() });
    expect(html).toContain('Today');
    expect(html).toContain('The week');
    expect(html).toContain('OPEN'); // day axis active
  });
});

describe('FuseHero — archetype tips (Phase 4 / R12)', () => {
  it('a resolved code-id, an unknown id, and a wholly-unresolved seat ALL render tips (defined fallback, never a crash)', () => {
    const seats = [
      { ...SEATS[0], archId: 'degen' },                 // resolved — Speculator mech
      { ...SEATS[1], archId: 'momentum_chaser' },       // resolved — deterministic CPU
      { ...SEATS[2], archId: 'not_a_real_archetype' },  // unknown id → neutral/generic
      { ...SEATS[3], archId: null, arch: undefined },   // unresolved → neutral/generic
    ];
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail(), seats });
    for (const id of IDS) expect(html).toContain(`data-fh-tip="${id}"`);
  });
});

describe('FuseHero — initialScope seeds without locking (D2)', () => {
  it('opens in the seeded scope', () => {
    const week = render({ state: 'live', mode: 'ranked', trail: liveTrail(), initialScope: 'week' });
    expect(week).toContain('MON');
    expect(week).not.toContain('OPEN');
    const day = render({ state: 'live', mode: 'ranked', trail: liveTrail(), initialScope: 'day' });
    expect(day).toContain('OPEN');
    expect(day).not.toContain('MON');
  });

  it('leaves the toggle live — both options still render and are clickable', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail(), initialScope: 'week' });
    expect(html).toContain('Today');
    expect(html).toContain('The week');
    expect(html.split('<button').length - 1).toBeGreaterThanOrEqual(2);
  });

  it('a hard `scope` prop still overrides the seed (host control is unchanged)', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail(), initialScope: 'week', scope: 'day' });
    expect(html).toContain('OPEN');
    expect(html).not.toContain('MON');
  });
});

describe('FuseHero — E1: the tape is gone, the atmosphere is texture-only', () => {
  it('emits NO scrolling tape and no ticker glyphs', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail() });
    expect(html).not.toContain('fhTapeScroll');
    expect(html).not.toMatch(/NVDA \+1\.4|MSFT −0\.3|AVGO/); // the old tape string
  });

  it('renders the shared atmosphere instead — gradient/aurora/particles, no text', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail() });
    expect(html).toContain('bv2-aurora1');
    expect(html).toContain('bv2-particles');
  });

  it('the reload state no longer leads with wallpaper: no tape in an empty plot', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: emptyTrail({ ...SEEDS }) });
    expect(html).not.toContain('fhTapeScroll');
    expect(html).toContain('data-fh-tip="you"');
  });
});

describe('FuseHero — E2: the header names the quantity, the crown shows its basis', () => {
  it('E2.1 — Today names what the numbers are; The Week names its own', () => {
    const day = render({ state: 'live', mode: 'ranked', trail: liveTrail(), initialScope: 'day' });
    expect(day).toMatch(/Today · since the open/i);
    expect(day).not.toContain('The session'); // the old, unqualified microcopy
    const week = render({ state: 'live', mode: 'ranked', trail: liveTrail(), initialScope: 'week' });
    expect(week).toMatch(/The week · running total/i);
  });

  it('E2.2 — in Today the crowned seat carries the TOTAL that earned the crown', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail(), initialScope: 'day' });
    expect(html).toContain('data-fh-subvalue');
    expect(html).toContain('25.0 total');       // r1 leads on standing
    // exactly one seat carries it — it is a crown annotation, not a row label
    expect(html.split('data-fh-subvalue').length - 1).toBe(1);
  });

  it('E2.2 — The Week shows NO second line (there the value already IS the total)', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail(), initialScope: 'week' });
    expect(html).not.toContain('data-fh-subvalue');
  });

  it('E2.2 — voided suppresses it along with the crown', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: liveTrail(), initialScope: 'day', voided: true });
    expect(html).not.toContain('data-fh-subvalue');
    expect(html).not.toContain('data-fh-crown');
  });
});

describe('FuseHero — E4: the header yields to the NOW pill, then returns', () => {
  // burnX follows the newest sample's clock position, so an early-session trail
  // collides and a mid-afternoon one does not.
  const trailAt = (hhmmZ) => appendTrailSnapshot(emptyTrail({ ...SEEDS }), {
    ids: IDS,
    scoresAtLast: { you: 12, r1: 25, r2: 13, r3: 11 },
    seatLive: Object.fromEntries(IDS.map((id) => [id, true])),
    t: T(hhmmZ),
  });

  it('early session (9:35): the microcopy is GONE, the pill keeps its true x', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: trailAt('13:35'), initialScope: 'day' });
    expect(html).not.toContain('data-fh-header');
    expect(html).not.toMatch(/Today · since the open/i);
    expect(html).toContain('NOW'); // the functional mark never moves or hides
  });

  it('mid-afternoon (14:15): the microcopy is back, both render together', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: trailAt('18:15'), initialScope: 'day' });
    expect(html).toContain('data-fh-header');
    expect(html).toMatch(/Today · since the open/i);
    expect(html).toContain('NOW');
  });

  it('it is a clean disappearance — the element is absent, not truncated or faded', () => {
    const html = render({ state: 'live', mode: 'ranked', trail: trailAt('13:35'), initialScope: 'day' });
    // the whole span is gone…
    expect(html).not.toContain('data-fh-header');
    // …so no fragment of the MICROCOPY survives (a truncation leaves a prefix).
    // Scoped to its distinctive phrase: the bare word "Today" is also the scope
    // toggle's button label and legitimately stays on screen.
    expect(html).not.toMatch(/since the open/i);
    expect(html).not.toMatch(/ellipsis|text-overflow/i);
    expect(html).toContain('>Today<'); // the toggle is untouched by the yield
  });

  it('awaiting keeps its start-line copy (no pill to collide with)', () => {
    const html = render({ state: 'awaiting', mode: 'ranked', trail: emptyTrail({}) });
    expect(html).toContain('At the start line');
    expect(html).not.toContain('NOW');
  });
});

describe('FuseHero — F1/F2 at the render level', () => {
  // Five banked closes: makes LO −22,800 (the value that wrapped) AND saturates
  // weekTipF, parking the burn at plotR — the exact state F2 was observed in.
  const EXTREME_CLIMB = {
    you: [300, 900, 1500, 2100, 2600],
    r1: [12000, 26000, 33000, 40000, 44000],
    r2: [-200, -500, -700, -850, -900],
    r3: [-4000, -9000, -14000, -19000, -22800],
  };
  const extremeWeek = () => render({
    state: 'live', mode: 'ranked', climb: EXTREME_CLIMB, initialScope: 'week',
    trail: appendTrailSnapshot(emptyTrail({ you: 2600, r1: 44000, r2: -900, r3: -22800 }), {
      ids: IDS,
      scoresAtLast: { you: 2600, r1: 44000, r2: -900, r3: -22800 },
      seatLive: Object.fromEntries(IDS.map((id) => [id, true])),
      t: T('18:15'),
    }),
  });
  const labelTexts = (html) => [...html.matchAll(/left:5px[^>]*>(.*?)<\/div>/g)]
    .map((m) => m[1].replace(/<[^>]*>/g, ''));

  it('F1 — the value that wrapped renders abbreviated, on one line', () => {
    const texts = labelTexts(extremeWeek());
    expect(texts).toContain('-22.8k');
    expect(texts).not.toContain('-22800.0'); // the form too wide for the gutter
  });

  it('F1 — EVERY rendered y-label fits the gutter (width, not collision)', () => {
    const gutter = yGutterWidth(FH.desktop.padL);
    for (const t of labelTexts(extremeWeek())) {
      expect(monoWidth(t, 9.5), `"${t}" overflows the ${gutter}px gutter`).toBeLessThanOrEqual(gutter);
    }
  });

  it('F1 — full precision is kept where it fits (abbreviation is a fallback)', () => {
    const texts = labelTexts(render({ state: 'live', mode: 'ranked', trail: liveTrail() }));
    expect(texts.some((t) => /^\+?\d+\.\d$/.test(t))).toBe(true);
  });

  it('F1 — y-label boxes are nowrap, so no future format can break a number', () => {
    const html = extremeWeek();
    const boxes = html.match(/position:absolute;left:5px[^"]*/g) || [];
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) expect(b).toContain('white-space:nowrap');
  });

  it('F2 — at a full banked week the pill is pulled in, clear of the toggle', () => {
    const html = extremeWeek();
    const m = html.match(/data-fh-now[^>]*left:([0-9.]+)px/);
    expect(m, 'the NOW pill did not render').toBeTruthy();
    const pillLeft = parseFloat(m[1]);
    const frame = fuseFrame({ w: 1316, h: 420 });
    expect(pillLeft).toBeLessThan(frame.plotR);                        // displaced from the burn
    expect(pillLeft + 18).toBeLessThan(scopeToggleLeft({ w: 1316 }));  // and clear of the control
  });

  it('F2 — the toggle never yields: both controls still render at the collision', () => {
    const html = extremeWeek();
    expect(html).toContain('>Today<');
    expect(html).toContain('>The week<');
  });
});
