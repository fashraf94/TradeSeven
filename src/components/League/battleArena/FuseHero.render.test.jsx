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
import { FH } from './fuseGeometry';

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
    expect(html).not.toMatch(/fhEmber|fhSpark|fhCreep|fhFly|fhHeat|fhTapeScroll/);
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
