// BLOCKING real-bounds reachability regression for the League battle chat composer
// (headless Chromium).
//
// renderToStaticMarkup has no layout engine, so the render-smoke test cannot see that
// the ASK-YOUR-AGENT composer is pushed BELOW the fixed 288px dock cell by the six
// long live ask chips — the exact desktop defect this branch fixes (pills + composer
// shared one unshrinkable footer, so the chips shoved the composer past the fold where
// the arena's scale-to-fit overflow:hidden clipped it).
//
// This renders the REAL ArenaDesktop at DESIGN GEOMETRY — 1360×800, scale = 1 — inside
// a faithful copy of the LeagueBattleArenaLive clip chain (the two overflow:hidden
// wrappers that clip anything past AD_H). The arena is SCALED, never reflowed, so
// reachability is a property of the design geometry: proving it once here proves it at
// every viewport. It injects the shipped battleArena.css and Tailwind-preflight
// border-box (which the fixed-cell math assumes), then asserts, at scrollTop:0 ("battle
// open"):
//   • the pinned composer footer sits INSIDE the dock cell — reachable, not clipped;
//   • that footer is a small FIXED height (≤120px) so the well keeps most of the 288px;
//   • the first suggestion pill is on screen (visible at open);
//   • the well actually scrolls (content exceeds it) — i.e. this is the real overflow
//     case, exercised for BOTH the live-chat path and the 6-chip fixtures preview.
//
// Guarded to skip cleanly where no Chromium binary is present.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArenaDesktop } from './ArenaDesktop';
import { AD_W, AD_H, DOCK_H } from './arenaLayout';

const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-bounds-'));
const hasBrowser = fs.existsSync(CHROME);
const BATTLE_CSS = fs.readFileSync(new URL('./battleArena.css', import.meta.url), 'utf8');

// Tailwind preflight ships `*{box-sizing:border-box}` app-wide (@tailwind base) — the
// arena's fixed-geometry math (cell = DOCK_H incl. padding) depends on it, so replicate
// it here. NOT a content-box default.
const GLOBAL_CSS = `
  html,body{margin:0;padding:0;background:#050609}
  *,*::before,*::after{box-sizing:border-box}
  ${BATTLE_CSS}
`;

// The six LIVE ask chips (buildArenaModel.buildAskChips: 5 STRATEGY_CHIPS + the
// youRank≤2 standing slot) — the set that overflows where 3 short fixtures did not.
const CHIP_TEXT = [
  "What's your plan from here?",
  'Where are we winning and losing right now?',
  'How do my three picks compare to your six?',
  'What would you change about our lineup?',
  'What are you watching for the rest of the battle?',
  'How do we protect the lead?',
];

// A buildArenaModel-shaped live model (mirrors ArenaDesktop.smoke.test's DATA) with a
// full voice lane, so the well is under real pressure at open.
const baseData = {
  seats: [
    { id: 'you', name: 'You', kind: 'you', you: true, color: '#5EEAD4', arch: 'Speculator' },
    { id: 'cpu-1', name: 'CPU — Trend Follower', kind: 'cpu', you: false },
    { id: 'r', name: 'Riva', kind: 'human', you: false, owner: 'Riva' },
    { id: 'cpu-2', name: 'CPU — Contrarian', kind: 'cpu', you: false },
  ],
  climb: { you: [-1.2, 1.4], 'cpu-1': [2.1, 3.0], r: [3.2, 5.8], 'cpu-2': [0.4, -0.8] },
  youId: 'you',
  agentStars: [{ tk: 'NVDA', tier: 'star', dir: 'long', mult: 0.7, banked: 0, points: 0, badge: null, state: 'heating', justIn: false }],
  userStars: [{ tk: 'GE', tier: 'support', dir: 'long', mult: 0.6, banked: 0, points: 0, badge: null, state: 'heating', justIn: false }],
  beats: [],
  voice: {
    arch: 'Speculator',
    greet: { kind: 'greeting', text: "We're live. I've got the six, you've got your three and the claim wire. Let's climb." },
    wait: { kind: 'anticipation', text: 'Lineup locked.' },
    live: [
      { kind: 'read', t: '32m', text: "PLTR's carrying its weight — letting it run. COIN and SMCI are dead weight, watching for the door." },
      { kind: 'trade', t: '1h', ticker: 'MSTR', text: "Cut SOFI — too quiet for us. MSTR's swinging hard, and that's where our edge is. In." },
      { kind: 'anticipation', t: '4m', ticker: 'MSTR', text: 'MSTR earnings after the bell. If it pops, we jump the field. Holding tight.' },
    ],
  },
  pod: { day: 2, days: 5, watchers: 47, toOpen: null, nextClose: null },
  wire: { open: true, closes: 600, claimsUsed: 0, claimsTotal: 3 },
  youRank: 3, headline: 'mult',
  claim: { picks: [{ symbol: 'GE' }], poolNames: ['NVDA'], claimsUsed: 0, claimsTotal: 3, open: true },
  agentMove: null,
};
// Real battle identity → chatReady → the two-way composer input (live path).
const liveData = { ...baseData, battleId: 'b1', agentId: 'ag1', ask: CHIP_TEXT.map((q) => ({ q })) };

// The clip chain at scale = 1 (LeagueBattleArenaLive.jsx:72-79): two overflow:hidden
// wrappers clip anything past AD_H — the same clip that hid the composer.
const pageHtml = (arenaHtml) => `<!doctype html><html><head><meta charset="utf-8"><style>${GLOBAL_CSS}</style></head><body>
  <div style="width:100%;background:#050609;overflow:hidden">
    <div style="height:${AD_H}px;overflow:hidden">
      <div style="width:${AD_W}px;height:${AD_H}px">${arenaHtml}</div>
    </div>
  </div></body></html>`;

// data=null → the fixtures preview (now 6 chips via ARENA_ASK); data=liveData → the
// real two-way composer. BOTH must keep the composer inside the cell.
const VARIANTS = [
  { key: 'live-chat', data: liveData },
  { key: 'fixtures-preview', data: null },
];

// In-page: at scrollTop:0 ("battle open"), locate the dock cell / well / pinned footer
// and report the box metrics that prove reachability.
const MEASURE = () => {
  const well = [...document.querySelectorAll('.bv2-scroll')].find((el) => getComputedStyle(el).overflowY === 'auto');
  if (!well) return { wellFound: false };
  const panel = well.parentElement;       // AgentDock root === the dock cell (stretched to DOCK_H)
  const footer = panel.lastElementChild;  // the pinned composer footer (flex:0 0 auto)
  const cellR = panel.getBoundingClientRect();
  const footerR = footer.getBoundingClientRect();
  const pills = [...well.querySelectorAll('button')];
  const firstPill = pills[0] ? pills[0].getBoundingClientRect() : null;
  return {
    wellFound: true,
    cellHeight: Math.round(cellR.height),
    footerHeight: Math.round(footerR.height),
    wellClientHeight: Math.round(well.clientHeight),
    scrollTopAtOpen: Math.round(well.scrollTop),
    wellScrolls: well.scrollHeight > well.clientHeight + 1,      // real overflow case
    pillCount: pills.length,
    // reachability: the footer never crosses below the dock cell (⇒ never clipped)
    footerBelowCell: Math.round(footerR.bottom - cellR.bottom),  // ≤0 ⇒ inside the cell
    // pills visible at open: first pill inside the cell AND above the composer
    firstPillInCell: firstPill ? (firstPill.top >= cellR.top - 1 && firstPill.bottom <= cellR.bottom + 1) : false,
    firstPillAboveComposer: firstPill ? (firstPill.bottom <= footerR.top + 1) : false,
  };
};

describe.skipIf(!hasBrowser)('AgentDock — battle composer reachability at design geometry (Chromium)', () => {
  let browser;
  beforeAll(async () => {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  }, 60000);
  afterAll(async () => { if (browser) await browser.close(); });

  for (const v of VARIANTS) {
    it(`${v.key}: composer stays inside the 288px cell; pills visible at open`, async () => {
      const html = renderToStaticMarkup(<ArenaDesktop state="live" mode="ranked" data={v.data} onBack={null} />);
      fs.writeFileSync(path.join(OUT, `arena-${v.key}.html`), pageHtml(html));
      const pg = await browser.newPage({ viewport: { width: AD_W + 80, height: AD_H + 200 } });
      await pg.goto('file://' + path.join(OUT, `arena-${v.key}.html`));
      const d = await pg.evaluate(MEASURE);
      await pg.close();

      // Reported so the pinned-footer height in design space is visible in CI output.
      console.log(`[${v.key}] footerHeight=${d.footerHeight}px  cellHeight=${d.cellHeight}px  wellClient=${d.wellClientHeight}px  wellScrolls=${d.wellScrolls}  pills=${d.pillCount}`);

      expect(d.wellFound, 'no scroll well found').toBe(true);
      expect(d.scrollTopAtOpen, 'well is not anchored at the top at open').toBe(0);
      expect(Math.abs(d.cellHeight - DOCK_H), `dock cell is ${d.cellHeight}px, expected ~${DOCK_H}`).toBeLessThanOrEqual(2);
      expect(d.pillCount, 'the six live ask chips did not all render').toBe(6);
      // THE reachability assertion: the composer footer never crosses below the cell.
      expect(d.footerBelowCell, `composer footer is ${d.footerBelowCell}px below the dock cell (clipped)`).toBeLessThanOrEqual(1);
      // Founder gate: the pinned footer must stay small so the well retains the cell.
      expect(d.footerHeight, `pinned footer is ${d.footerHeight}px (>120 ⇒ stop before merge)`).toBeLessThanOrEqual(120);
      // Pills reachable at open without scrolling.
      expect(d.firstPillInCell, 'first suggestion pill is not on screen at open').toBe(true);
      expect(d.firstPillAboveComposer, 'first pill overlaps/sits below the composer').toBe(true);
      // Guard that this is the genuine overflow scenario (not a trivially-small case).
      expect(d.wellScrolls, 'the well does not scroll — 6 chips + voice did not exceed it').toBe(true);
    }, 60000);
  }
});
