// G4 — RENDER evidence for the mobile fuse hero at its floor height.
//
// Arithmetic is not the test, and this arc has the scars: F1's wrap defect
// passed its unit test and failed on the board; the NOW pill cleared by 5px on
// paper and touched in practice. Both were fit-versus-collision confusions and
// both were caught by looking. So this measures the REAL layout in Chromium at
// the shortest usable viewport rather than asserting the numbers agree.
//
// Harness mirrors AgentDock.bounds.browser.test.jsx. Skips cleanly with no
// Chromium binary present.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import process from 'node:process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FuseHero } from './FuseHero';
import { FUSE_REVIEW_CASES } from './fuseReviewCases';
import { MOBILE_HERO_MIN, MOBILE_STICKY_CHROME, MOBILE_DOCK_ROW } from './mobileHeroHeight';
import { FH, yGutterWidth, monoWidth } from './fuseGeometry';

const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const hasBrowser = fs.existsSync(CHROME);
const BATTLE_CSS = fs.readFileSync(new URL('./battleArena.css', import.meta.url), 'utf8');
const CSS = `html,body{margin:0;padding:0;background:#050609}*,*::before,*::after{box-sizing:border-box}${BATTLE_CSS}`;

const SE_USABLE = 553;
const HERO_W = 362; // 390 viewport − 14px sticky padding each side

const SEATS = [
  { id: 'vela', name: 'Vela', color: '#F2C14E' },
  { id: 'atlas', name: 'Atlas', you: true, color: '#5EEAD4' },
  { id: 'helios', name: 'Helios', color: '#B79CED' },
  { id: 'ember', name: 'Ember', color: '#E07A6B' },
];

let browser; let pg;
beforeAll(async () => {
  if (!hasBrowser) return;
  const { chromium } = await import('playwright-core');
  browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  pg = await browser.newPage({ viewport: { width: 390, height: SE_USABLE } });
}, 60000);
afterAll(async () => { if (browser) await browser.close(); });

async function mount({ h, caseKey = 'bunched', scope = 'day' }) {
  const C = FUSE_REVIEW_CASES[caseKey];
  const html = renderToStaticMarkup(
    <FuseHero
      state="live" mode="ranked" seats={SEATS} climb={C.climb} youId="atlas" dayIdx={4}
      w={HERO_W} h={h} compact trail={C.trail} initialScope={scope}
    />,
  );
  await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${html}</body></html>`);
}

const MEASURE = () => {
  const tips = [...document.querySelectorAll('[data-fh-tip]')];
  const heads = tips.map((t) => {
    const inner = [...t.children].find((c) => c.tagName === 'DIV' && (c.getAttribute('style') || '').includes('left:12px'));
    const r = (inner || t).getBoundingClientRect();
    return { id: t.getAttribute('data-fh-tip'), top: r.top, bottom: r.bottom, right: r.right, mid: r.top + r.height / 2 };
  }).sort((a, b) => a.mid - b.mid);
  let minGap = Infinity;
  for (let i = 1; i < heads.length; i++) minGap = Math.min(minGap, heads[i].top - heads[i - 1].bottom);
  const elbows = [...document.querySelectorAll('[data-fh-tip] span')].filter((s) => {
    const st = s.getAttribute('style') || '';
    return st.includes('border-left') && st.includes('border-top');
  }).length;
  const labelBoxes = [...document.querySelectorAll('div')].filter((d) => (d.getAttribute('style') || '').includes('left:5px'));
  return {
    heads: heads.length,
    minGap,                                   // NEGATIVE means heads overlap
    lowestBottom: heads[heads.length - 1].bottom,
    widestRight: Math.max(...heads.map((h) => h.right)),
    elbows,
    labels: labelBoxes.length,
    labelOverflow: labelBoxes.filter((d) => d.scrollWidth > d.clientWidth + 0.5).length,
    labelWrapped: labelBoxes.filter((d) => d.getBoundingClientRect().height > 20).length,
  };
};

describe.skipIf(!hasBrowser)('G4 — the fuse READS at its floor on the shortest usable viewport', () => {
  it('four bunched seats de-collide without overlapping heads', async () => {
    await mount({ h: MOBILE_HERO_MIN });
    const m = await pg.evaluate(MEASURE);
    expect(m.heads).toBe(4);
    expect(m.minGap, 'heads overlap at the floor height').toBeGreaterThan(0);
  });

  it('every head and its value stay INSIDE the hero box', async () => {
    await mount({ h: MOBILE_HERO_MIN });
    const m = await pg.evaluate(MEASURE);
    expect(m.lowestBottom).toBeLessThanOrEqual(MOBILE_HERO_MIN);
    expect(m.widestRight).toBeLessThanOrEqual(HERO_W); // compact TIPROOM holds
  });

  it('the elbow connectors still draw when heads are displaced', async () => {
    await mount({ h: MOBILE_HERO_MIN });
    const m = await pg.evaluate(MEASURE);
    expect(m.elbows).toBeGreaterThan(0);
  });

  it('y-labels fit the compact gutter — none wraps or overflows', async () => {
    await mount({ h: MOBILE_HERO_MIN, caseKey: 'extremes', scope: 'week' });
    const m = await pg.evaluate(MEASURE);
    expect(m.labels).toBeGreaterThan(0);
    expect(m.labelOverflow, 'a label overflows its gutter').toBe(0);
    expect(m.labelWrapped, 'a label wrapped to a second line').toBe(0);
  });

  it('the cut line and its band render in a ranked week at the floor', async () => {
    await mount({ h: MOBILE_HERO_MIN, caseKey: 'underwater', scope: 'week' });
    const hasCut = await pg.evaluate(() => !!document.querySelector('[data-fh-cut]'));
    expect(hasCut).toBe(true);
  });

  it('the head stack is HEIGHT-INDEPENDENT — the finding that refuted the arithmetic', async () => {
    // spreadLabels pushes a tight cluster to the compact minimum gap and clamps
    // it to the TOP bound; neither term depends on h. So hero height does not
    // govern four-seat de-collision, and 185 (two full dock rows) is fine.
    const at = async (h) => { await mount({ h }); return pg.evaluate(MEASURE); };
    const small = await at(185);
    const large = await at(384);
    expect(small.lowestBottom).toBeCloseTo(large.lowestBottom, 1);
    expect(small.minGap).toBeCloseTo(large.minGap, 1);
    expect(small.lowestBottom).toBeLessThanOrEqual(185); // fits the two-row hero
  });

  it('at 185 — the two-full-rows height — the board still renders correctly', async () => {
    await mount({ h: 185 });
    const m = await pg.evaluate(MEASURE);
    expect(m.heads).toBe(4);
    expect(m.lowestBottom).toBeLessThanOrEqual(185);
    expect(m.labelOverflow).toBe(0);
    expect(m.labelWrapped).toBe(0);
  });

  it('SEPARATE FINDING: heads sit ~0.5px apart at EVERY height, including today\'s 384', async () => {
    // A compact headGap (30) vs head size (25-30) problem, present before this
    // phase and unaffected by it. Recorded so it is not mistaken for a Phase 6
    // regression, and so the number is on file for its own tasking.
    for (const h of [185, 220, 384]) {
      await mount({ h });
      const m = await pg.evaluate(MEASURE);
      expect(m.minGap).toBeLessThan(3);
      expect(m.minGap).toBeGreaterThan(0); // touching, but never overlapping
    }
  });

  it('records the measured budget the ruling rests on', () => {
    expect(MOBILE_STICKY_CHROME).toBe(110);
    expect(MOBILE_DOCK_ROW).toBe(129);
    expect(SE_USABLE - MOBILE_STICKY_CHROME - 2 * MOBILE_DOCK_ROW).toBe(185);
    expect(monoWidth('-22.8k', 8)).toBeLessThanOrEqual(yGutterWidth(FH.compact.padL));
  });
});
