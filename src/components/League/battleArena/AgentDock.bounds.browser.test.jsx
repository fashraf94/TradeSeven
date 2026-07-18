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
import { AgentDock } from './CommandDock';
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

// ── change-1 (answer-scroll) fixtures ───────────────────────────────────────
// A post-answer voice lane: newest-first, so the ANSWER (unique marker) is lines[0] —
// the top of the voice lane, which sits below the pills and thus below the fold at open.
const ANSWER_MARK = 'NEWEST_ANSWER_MARKER';
const LINES_WITH_ANSWER = [
  { kind: 'answer', q: 'How do we protect the lead?', text: `${ANSWER_MARK} — bank what's working, don't chase; let PLTR run and keep MSTR.`, t: 'now', _k: 991 },
  { kind: 'read', t: '32m', text: 'PLTR is carrying its weight; COIN and SMCI are dead weight, watching the door.', _k: 3 },
  { kind: 'trade', t: '1h', ticker: 'MSTR', text: 'Cut SOFI — too quiet for us. MSTR is swinging hard. In.', _k: 2 },
  { kind: 'anticipation', t: '4m', ticker: 'MSTR', text: 'MSTR earnings after the bell. Holding tight.', _k: 1 },
  { kind: 'greeting', text: "We're live. I've got the six, you've got your three. Let's climb.", t: 'now', _k: 0 },
];

// AgentDock in a faithful dock cell (the ArenaDesktop dock row: fixed DOCK_H, the real
// 1.35/1.3/1.02 width split) so the chat panel gets its real ~359px width and 288px
// height — but with `lines` we control, so lines[0] can be a landed answer (which the
// engine-seeded ArenaDesktop path can't produce in static markup). Wrapped in a
// transform:scale like LeagueBattleArenaLive so the answer-scroll is exercised under
// the real CSS scaling too (scale<1 is why the scroll must use offsetTop, not rects).
const dockCellHtml = (scale) => `<div style="width:100%;overflow:hidden"><div style="transform:scale(${scale});transform-origin:top left;width:${AD_W}px">${renderToStaticMarkup(
  <div style={{ width: AD_W, padding: '0 22px', boxSizing: 'border-box' }}>
    <div style={{ height: DOCK_H, display: 'flex', gap: 12, minHeight: 0 }}>
      <div style={{ flex: 1.35 }} />
      <div style={{ flex: 1.3 }} />
      <AgentDock live lines={LINES_WITH_ANSWER} archName="Speculator" ask={CHIP_TEXT.map((q) => ({ q }))}
        onAsk={() => {}} askLive={() => {}} remaining={10} asking={false} chatReady style={{ flex: 1.02 }} />
    </div>
  </div>,
)}</div></div>`;

// In-page: mirror AgentDock's onAnswer effect EXACTLY (well.scrollTop = voice.offsetTop -
// well.offsetTop — offsetTop is layout px, scale-independent) and report whether the
// newest entry was below the fold before, and where the voice-lane top lands after. The
// scale-independence is the point of the test: a getBoundingClientRect delta would
// under-scroll under transform:scale and leave voiceTopVsWellTop != 0.
const MEASURE_SCROLL = () => {
  const well = [...document.querySelectorAll('.bv2-scroll')].find((el) => getComputedStyle(el).overflowY === 'auto');
  if (!well) return { wellFound: false };
  const panel = well.parentElement;
  const cellR = panel.getBoundingClientRect();
  const voice = well.lastElementChild;       // the div wrapping VoiceLane (pills are before it)
  const hits = [...well.querySelectorAll('*')].filter((el) => (el.textContent || '').includes('NEWEST_ANSWER_MARKER'));
  const newest = hits.length ? hits[hits.length - 1] : null;  // deepest element carrying the marker
  if (!newest) return { wellFound: true, newestFound: false };
  const onScreen = (r) => r.top < cellR.bottom && r.bottom > cellR.top && r.top >= cellR.top - 1;
  const beforeVisible = onScreen(newest.getBoundingClientRect());
  well.scrollTop = voice.offsetTop - well.offsetTop;
  return {
    wellFound: true, newestFound: true,
    wellScrolls: well.scrollHeight > well.clientHeight + 1,
    scrollTopAfter: Math.round(well.scrollTop),
    beforeVisible,
    afterVisible: onScreen(newest.getBoundingClientRect()),
    // after a correct scroll the voice-lane top sits at the well viewport top (both in
    // the same scaled space) — nonzero ⇒ the scroll under/over-shot (the scale bug).
    voiceTopVsWellTop: Math.round(voice.getBoundingClientRect().top - well.getBoundingClientRect().top),
  };
};

// Minimal page for the answer-scroll case: the (optionally scaled) dock cell + the
// shipped CSS. No 1360×800 clip chain needed — this measures the cell's own well.
const scrollPage = (scale) => `<!doctype html><html><head><meta charset="utf-8"><style>${GLOBAL_CSS}</style></head><body>${dockCellHtml(scale)}</body></html>`;

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

  // scale 1 = design geometry (founder's ask); scale 0.7 = a real sub-1360 desktop, where
  // the scroll MUST be scale-independent (offsetTop) — this case fails if it regresses to
  // a getBoundingClientRect delta.
  for (const scale of [1, 0.7]) {
    it(`live-chat @scale ${scale}: newest voice entry on screen after an answer lands`, async () => {
      fs.writeFileSync(path.join(OUT, `arena-answer-scroll-${scale}.html`), scrollPage(scale));
      const pg = await browser.newPage({ viewport: { width: AD_W + 80, height: AD_H + 200 } });
      await pg.goto('file://' + path.join(OUT, `arena-answer-scroll-${scale}.html`));
      const d = await pg.evaluate(MEASURE_SCROLL);
      await pg.close();

      console.log(`[answer-scroll @${scale}] beforeVisible=${d.beforeVisible} afterVisible=${d.afterVisible} scrollTopAfter=${d.scrollTopAfter}px voiceTopVsWellTop=${d.voiceTopVsWellTop}px`);

      expect(d.wellFound, 'no scroll well found').toBe(true);
      expect(d.newestFound, 'the newest answer entry was not found in the well').toBe(true);
      expect(d.wellScrolls, 'the well does not scroll — the answer-scroll case is not exercised').toBe(true);
      // The reply is below the fold at open (pills fill the well top) …
      expect(d.beforeVisible, 'newest answer was already on screen before the scroll — case not meaningful').toBe(false);
      // … and the onAnswer scroll brings it into view.
      expect(d.scrollTopAfter, 'the well did not scroll on answer').toBeGreaterThan(0);
      expect(d.afterVisible, 'newest answer entry is not on screen after the answer-scroll').toBe(true);
      // scale-independence: the voice-lane top must land at the well top at BOTH scales.
      expect(Math.abs(d.voiceTopVsWellTop), `voice top ${d.voiceTopVsWellTop}px off the well top — scroll mis-targeted under scale`).toBeLessThanOrEqual(2);
    }, 60000);
  }
});
