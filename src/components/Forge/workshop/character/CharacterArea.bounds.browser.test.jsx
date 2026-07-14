// REAL-BOUNDS reachability regression (the one a "does it render" test can't be).
//
// The render smoke passed green through three separate unreachable-content bugs
// because SSR/jsdom has no layout engine — it cannot tell whether a control that
// EXISTS can actually be SCROLLED TO. This test renders the real CharacterArea
// inside a faithful reproduction of the ForgeWorkshop modal shell chain + the real
// global CSS, loads it in real Chromium, and for BOTH sub-views at BOTH breakpoints
// asserts that EVERY interactive control (Equip buttons, tempo dial positions,
// roster switchers) can be scrolled fully into the scroll owner's client box — i.e.
// has reachable bounds, not just present markup.
//
// Chromium is pre-installed in this environment (PLAYWRIGHT_BROWSERS_PATH); where it
// is absent (some CI) the suite skips cleanly rather than failing — the portable
// structural guard lives in CharacterArea.reachability.test.jsx and the stateful
// root-cause guard in CharacterArea.scrollreset.test.jsx.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

vi.mock('../../../../services/agentService.js', () => ({
  equipLean: vi.fn(() => Promise.resolve({})),
  unequipLean: vi.fn(() => Promise.resolve({})),
  setTempoDial: vi.fn(() => Promise.resolve({})),
}));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ForgeKitProvider } from '../forgeKit.jsx';
import CharacterArea from './CharacterArea.jsx';

const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-bounds-'));
const hasBrowser = fs.existsSync(CHROME);

// A realistic agent — equipped born-with traits + a standing lean, so column heights
// reflect production, not an empty fixture.
const agent = {
  id: 'a1', archetype: 'momentum_chaser',
  standingLeans: [{ adjustmentId: 'TF-01', version: 1, equippedAt: 't' }],
  dials: { tempo: 'standard' },
};
const traits = {
  equippedTraits: [
    { traitId: 'trend_rider', name: 'Trend Rider', identityStatement: 'Rides established momentum until it breaks.', strength: 'dominant' },
    { traitId: 'breakout_hunter', name: 'Breakout Hunter', identityStatement: 'Leans into fresh highs.', strength: 'moderate' },
  ],
};

// The real global rules that touch the Forge subtree (index.css) + box-sizing.
const GLOBAL_CSS = `
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;padding:0;height:100%}
  * { word-wrap: break-word; overflow-wrap: break-word; }
  img, video, canvas, svg { max-width: 100%; height: auto; }
  @keyframes fwFade { from{opacity:0} to{opacity:1} }
  .fw-scroll::-webkit-scrollbar { width:0; height:0; } .fw-scroll { scrollbar-width:none; }
`;

// Faithful ForgeWorkshop shell chain (ForgeWorkshop.jsx:182-197).
const pageHtml = (areaHtml) => `<!doctype html><html><head><meta charset="utf-8"><style>${GLOBAL_CSS}</style></head><body>
  <div style="height:100vh;width:100%;display:flex;justify-content:center;overflow:hidden;background:#0b0d12">
    <div style="width:100%;max-width:1200px;height:100%;display:flex;flex-direction:column">
      <div style="flex-shrink:0;height:92px;border-bottom:1px solid #222"></div>
      <div style="flex:1;min-width:0;position:relative;overflow:hidden">
        <div style="height:100%;animation:fwFade .25s ease both">${areaHtml}</div>
      </div>
    </div>
  </div></body></html>`;

const render = (initialSub, twoCol) => renderToStaticMarkup(
  <ForgeKitProvider tokens={{}}>
    <CharacterArea agent={agent} agentName="Vera" traits={traits} twoCol={twoCol} initialSub={initialSub} showToast={() => {}} />
  </ForgeKitProvider>,
);

const VARIANTS = [
  { key: 'character', sub: 'character', twoCol: true, vw: 1280, vh: 800 },
  { key: 'explore', sub: 'explore', twoCol: true, vw: 1280, vh: 800 },
  { key: 'character', sub: 'character', twoCol: false, vw: 390, vh: 844 },
  { key: 'explore', sub: 'explore', twoCol: false, vw: 390, vh: 844 },
];

// Measure a single variant in Chromium: which interactive controls (if any) cannot
// be scrolled into the owner's client box, plus the two-column balance.
const MEASURE = () => {
  const owner = [...document.querySelectorAll('.fw-scroll')].find((el) => getComputedStyle(el).overflowY === 'auto');
  if (!owner) return { ownerFound: false };
  const oRect = () => owner.getBoundingClientRect();

  // interactive controls: every button under the owner (Equip/Remove, tempo, roster, slots…)
  const controls = [...owner.querySelectorAll('button')];
  const unreachable = [];
  for (const el of controls) {
    const before = owner.scrollTop;
    const rel = el.getBoundingClientRect().top - oRect().top + owner.scrollTop;
    owner.scrollTop = Math.max(0, Math.min(rel, owner.scrollHeight - owner.clientHeight));
    const r = el.getBoundingClientRect(); const o = oRect();
    // after scrolling to reveal it, the control must sit inside the client box
    const inside = r.top >= o.top - 2 && r.bottom <= o.bottom + 2;
    if (!inside) unreachable.push((el.textContent || '').trim().slice(0, 20) || '(button)');
    owner.scrollTop = before;
  }

  // targeted presence (below-the-fold interactive content actually rendered)
  const txt = (b) => (b.textContent || '').trim();
  const equipCount = controls.filter((b) => /^(Equip|Slots full|Remove)$/.test(txt(b))).length;
  const tempoLabels = ['Measured', 'Standard', 'Aggressive'].filter((l) => controls.some((b) => txt(b) === l)).length;

  // two-column balance (desktop): shorter column vs taller, to guard the dead-gap regression
  let balance = null;
  const grid = [...owner.querySelectorAll('div')].find((d) => /grid-template-columns:\s*1\.05fr/.test(d.getAttribute('style') || ''));
  if (grid && grid.children.length === 2) {
    const a = grid.children[0].getBoundingClientRect().height;
    const b = grid.children[1].getBoundingClientRect().height;
    balance = { left: Math.round(a), right: Math.round(b), ratio: +(Math.min(a, b) / Math.max(a, b)).toFixed(2) };
  }

  return {
    ownerFound: true,
    scrollH: owner.scrollHeight, clientH: owner.clientHeight, buttons: controls.length,
    unreachable, equipCount, tempoLabels, balance,
  };
};

describe.skipIf(!hasBrowser)('CharacterArea — real-bounds reachability (Chromium)', () => {
  let browser;
  beforeAll(async () => {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  }, 60000);
  afterAll(async () => { if (browser) await browser.close(); });

  for (const v of VARIANTS) {
    const label = `${v.key} · ${v.twoCol ? 'desktop' : 'mobile'}`;
    it(`${label}: every interactive control has reachable bounds inside the scroll owner`, async () => {
      fs.writeFileSync(path.join(OUT, `bounds-${v.key}-${v.vw}.html`), pageHtml(render(v.sub, v.twoCol)));
      const pg = await browser.newPage({ viewport: { width: v.vw, height: v.vh } });
      await pg.goto('file://' + path.join(OUT, `bounds-${v.key}-${v.vw}.html`));
      const d = await pg.evaluate(MEASURE);
      await pg.close();

      expect(d.ownerFound, 'no vertical scroll owner found').toBe(true);
      expect(d.buttons, 'no interactive controls rendered').toBeGreaterThan(0);
      // THE assertion the render-smoke could not make: nothing is stranded out of bounds.
      expect(d.unreachable, `controls unreachable by scrolling: ${d.unreachable.join(', ')}`).toEqual([]);

      if (v.key === 'character') {
        expect(d.equipCount, 'no Equip control below the identity fold').toBeGreaterThan(0);
        expect(d.tempoLabels, 'the three tempo dial positions are not all present').toBe(3);
        if (v.twoCol && d.balance) {
          // guard the dead-gap regression: the shorter of the two header columns must be
          // a reasonable fraction of the taller (not one column stranding a large void).
          console.log(`  ${label} column balance:`, JSON.stringify(d.balance));
          expect(d.balance.ratio, `two-column imbalance (${JSON.stringify(d.balance)})`).toBeGreaterThan(0.5);
        }
      }
    }, 60000);
  }
});
