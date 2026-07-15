// BLOCKING real-bounds reachability regression (headless Chromium).
//
// A "does it render" test cannot see whether rendered content is REACHABLE — it has
// no layout engine. This renders the real CharacterArea inside a faithful ForgeWorkshop
// shell chain, injects the REAL shipped forgeKit CSS (via the exported FORGE_WORKSHOP_CSS
// so it can't drift from production), and reproduces the app's ACTUAL box-sizing default
// (content-box — the global border-box reset is not reaching these nodes). It then, for
// BOTH sub-views at BOTH a normal AND a "dead-band" viewport, scrolls the owner to the
// bottom and asserts the bottom-most content sits inside the VISIBLE #body frame — not
// merely inside the owner, which overflows the frame when content-box.
//
// This is the test that catches the real bug: the .fw-scroll owner sets height:100% +
// 84px bottom padding; without box-sizing:border-box its border-box overflows the
// fixed-height #body (overflow:hidden) by the padding, and in the viewport band where
// content sits between the frame height and frame+padding the owner reports NOT
// scrollable while content still exceeds the visible frame — bottom stranded. Remove
// the border-box rule from FORGE_WORKSHOP_CSS and the dead-band cases below fail.
//
// Guarded to skip cleanly where no Chromium binary is present (adds playwright-core).

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
import { ForgeKitProvider, FORGE_WORKSHOP_CSS } from '../forgeKit.jsx';
import CharacterArea from './CharacterArea.jsx';

const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-bounds-'));
const hasBrowser = fs.existsSync(CHROME);

const agent = {
  id: 'a1', archetype: 'momentum_chaser',
  standingLeans: [{ adjustmentId: 'TF-01', version: 1, equippedAt: 't' }],
  dials: { tempo: 'standard' },
};
const traits = { equippedTraits: [{ traitId: 'trend_rider', name: 'Trend Rider', identityStatement: 'Rides momentum.', strength: 'dominant' }] };

// Global rules that touch the Forge subtree — but NOT a box-sizing reset: the real app
// ships without one reaching these nodes (that is the whole bug), so replicate that.
const GLOBAL_CSS = `
  html,body{margin:0;padding:0;height:100%}
  * { word-wrap: break-word; overflow-wrap: break-word; }
  img, video, canvas, svg { max-width: 100%; height: auto; }
  ${FORGE_WORKSHOP_CSS}
`;

// Faithful ForgeWorkshop shell chain (ForgeWorkshop.jsx:182-197). #body is the fixed
// frame (flex:1 + overflow:hidden); the CharacterArea .fw-scroll owner sits inside it.
const pageHtml = (areaHtml) => `<!doctype html><html><head><meta charset="utf-8"><style>${GLOBAL_CSS}</style></head><body>
  <div style="height:100vh;width:100%;display:flex;justify-content:center;overflow:hidden;background:#0b0d12">
    <div style="width:100%;max-width:1200px;height:100%;display:flex;flex-direction:column">
      <div style="flex-shrink:0;height:92px;border-bottom:1px solid #222"></div>
      <div id="fw-body" style="flex:1;min-width:0;position:relative;overflow:hidden">
        <div style="height:100%;animation:fwFade .25s ease both">${areaHtml}</div>
      </div>
    </div>
  </div></body></html>`;

const render = (initialSub, twoCol) => renderToStaticMarkup(
  <ForgeKitProvider tokens={{}}>
    <CharacterArea agent={agent} agentName="Vera" traits={traits} twoCol={twoCol} initialSub={initialSub} showToast={() => {}} />
  </ForgeKitProvider>,
);

// Desktop 800 = normal (content clearly exceeds frame). Desktop ~1400 = the dead band
// where Explore content sits between the frame height and frame+padding — the case that
// was unreachable when content-box. Mobile 844 = compact.
const VARIANTS = [
  { key: 'character', sub: 'character', twoCol: true, vw: 1280, vh: 800 },
  { key: 'explore', sub: 'explore', twoCol: true, vw: 1280, vh: 800 },
  { key: 'character', sub: 'character', twoCol: true, vw: 1280, vh: 1400, band: true },
  { key: 'explore', sub: 'explore', twoCol: true, vw: 1280, vh: 1400, band: true },
  { key: 'character', sub: 'character', twoCol: false, vw: 390, vh: 844 },
  { key: 'explore', sub: 'explore', twoCol: false, vw: 390, vh: 844 },
];

// In the page: scroll the owner to the bottom and report whether the bottom-most content
// lands inside the VISIBLE #body frame, whether every control is reachable, and the
// owner's box metrics.
const MEASURE = () => {
  const owner = [...document.querySelectorAll('.fw-scroll')].find((el) => el.style.overflowY === 'auto');
  if (!owner) return { ownerFound: false };
  const body = document.getElementById('fw-body');
  const cs = getComputedStyle(owner);
  const overhang = Math.round(owner.getBoundingClientRect().height - body.clientHeight);

  // every interactive control must be reachable: scroll it to the top of the owner, then
  // it must sit inside the visible #body frame.
  const controls = [...owner.querySelectorAll('button')];
  const unreachable = [];
  for (const el of controls) {
    const rel = el.getBoundingClientRect().top - owner.getBoundingClientRect().top + owner.scrollTop;
    owner.scrollTop = Math.max(0, Math.min(rel, owner.scrollHeight - owner.clientHeight));
    const r = el.getBoundingClientRect(); const b = body.getBoundingClientRect();
    // partially-in-frame is enough (some controls are taller than the frame is tall)
    if (!(r.bottom > b.top + 1 && r.top < b.bottom - 1)) unreachable.push((el.textContent || '').trim().slice(0, 18) || '(btn)');
  }

  // scroll to the very bottom; the deepest content must be inside the visible frame.
  owner.scrollTop = owner.scrollHeight;
  const b = body.getBoundingClientRect();
  let maxBottom = -Infinity;
  for (const el of owner.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.bottom > maxBottom) maxBottom = r.bottom;
  }
  const bottomContentPastFrame = Math.round(maxBottom - b.bottom); // >0 ⇒ stranded below the visible frame
  const txt = (el) => (el.textContent || '').trim();
  const equipCount = controls.filter((el) => /^(Equip|Slots full|Remove)$/.test(txt(el))).length;
  const tempoLabels = ['Measured', 'Standard', 'Aggressive'].filter((l) => controls.some((el) => txt(el) === l)).length;
  owner.scrollTop = 0;
  return { ownerFound: true, boxSizing: cs.boxSizing, overhang, buttons: controls.length, unreachable, bottomContentPastFrame, equipCount, tempoLabels };
};

describe.skipIf(!hasBrowser)('CharacterArea — real-bounds reachability (Chromium)', () => {
  let browser;
  beforeAll(async () => {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  }, 60000);
  afterAll(async () => { if (browser) await browser.close(); });

  for (const v of VARIANTS) {
    const label = `${v.key} · ${v.twoCol ? 'desktop' : 'mobile'}${v.band ? ' · dead-band vh' : ''}`;
    it(`${label}: content scrolls to its bottom inside the visible frame; every control reachable`, async () => {
      fs.writeFileSync(path.join(OUT, `b-${v.key}-${v.vw}-${v.vh}.html`), pageHtml(render(v.sub, v.twoCol)));
      const pg = await browser.newPage({ viewport: { width: v.vw, height: v.vh } });
      await pg.goto('file://' + path.join(OUT, `b-${v.key}-${v.vw}-${v.vh}.html`));
      const d = await pg.evaluate(MEASURE);
      await pg.close();

      expect(d.ownerFound, 'no scroll owner').toBe(true);
      // behavioral guard (robust to HOW the overhang is fixed): the owner's padding must
      // not push its border-box past the fixed-height #body frame that clips it.
      expect(d.overhang, `owner overflows #body frame by ${d.overhang}px (boxSizing=${d.boxSizing})`).toBeLessThanOrEqual(1);
      expect(d.buttons).toBeGreaterThan(0);
      expect(d.unreachable, `unreachable controls: ${d.unreachable.join(', ')}`).toEqual([]);
      // THE assertion: after scrolling to the bottom, no content is stranded below the frame.
      expect(d.bottomContentPastFrame, `bottom content stranded ${d.bottomContentPastFrame}px below the visible frame`).toBeLessThanOrEqual(2);

      if (v.key === 'character') {
        expect(d.equipCount, 'no Equip control rendered').toBeGreaterThan(0);
        expect(d.tempoLabels, 'the three tempo positions are not all present').toBe(3);
      }
    }, 60000);
  }
});
