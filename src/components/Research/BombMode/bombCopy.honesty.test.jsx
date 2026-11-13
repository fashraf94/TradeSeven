// @vitest-environment jsdom
//
// Research Modal Build A — THE FORBIDDEN-TERMS GUARD for every new string
// (spec §5 honesty). Three nets:
//   1. every BOMB_COPY template, rendered with representative arguments;
//   2. every view rendered in every state, its visible text and aria-labels;
//   3. every BombMode source file, comments stripped — so a string typed
//      inline in a component is caught even if no test renders it.
// The banned list: the Desk guard's agent verbs (deskHonesty.test.js FORBIDDEN —
// copied, it is not exported), the build's own three ("the agent held", "will
// bank", and "entry" on a preview), and forecast words a scoreboard never uses.
// A fourth rule keeps the nets honest: no component types copy inline — every
// JSX text node is an expression (from BOMB_COPY), never a literal word.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'acorn';
import acornJsx from 'acorn-jsx';
import { BOMB_COPY } from './bombCopy.js';
import FuseChart from './FuseChart.jsx';
import RedZone from './RedZone.jsx';
import BombSheet from './BombSheet.jsx';
import BombPlot, { RedZoneChip } from './BombPlot.jsx';
import { previewLadder, measuredLadder, v4Ladder, toGo, toGoDown } from './ladder.js';
import { sheetLine, scoredChipText, traceParts } from './bombView.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESK_FORBIDDEN = ['watching', 'thinking', 'researching', 'analyzing', 'about to', 'close to trading', 'wants to', 'looking at', 'eyeing', 'considering'];
const BUILD_FORBIDDEN = ['the agent held', 'will bank', 'guaranteed', 'will score', 'is going to'];
const ALL = [...DESK_FORBIDDEN, ...BUILD_FORBIDDEN];
const hit = (s, term) => new RegExp(`\\b${term.replace(/ /g, '\\s+')}\\b`, 'i').test(s);

const measured = measuredLadder({ measured: { measured: true, baselinePrice: 100.75, targets: [['bagger', 102.765], ['doubleBagger', 103.7725], ['tenBagger', 104.78], ['bust', 98.735], ['crash', 97.7275], ['meltdown', 96.72]].map(([key, price]) => ({ key, price })), crossedTiers: ['bagger'] }, entryAtMs: Date.parse('2026-10-13T13:45:00.000Z') });
const preview = previewLadder({ previousClose: 99, threshold: 2 });
// Ruling 2026-11-07 (§0.4(a), rule (i)): a held legacy-scored position's preview (bombView.buildLadder).
const heldPreview = { ...previewLadder({ previousClose: 99, threshold: 2 }), heldPreview: true };
// BS-4 (2026-11-12): a non-held stock in a measured battle, at the rankings' ATR reading (bombView.buildLadder).
const atrPreview = { ...previewLadder({ previousClose: 99, threshold: 4.05 }), atrReading: { pct: 4.05, asOfMs: Date.parse('2026-10-14T16:05:00.000Z') } };
const v4 =v4Ladder({ levels: { baseline: 150, baggerBomb: 154.5, doubleBagger: 156.75, tenBagger: 159, bust: 145.5, crash: 143.25, meltdown: 141, threshold: 3 } });

// Every template is called with a value for each of its own parameters, by name;
// a template with a parameter missing here fails the coverage row below.
const ARG = { price: 160.33, d: 2, when: 'Tue 9:45 AM', label: 'BaggerBomb', pct: 2.4, points: 15, banked: true, time: '1:15', bricks: 3, base: '2.4% · 3 bricks to +30', live: 160.27, last: '$160.27', emoji: '💣', interval: '1-min', minutes: 1, scored: 160.19, at: '1:00', clockLabel: '3:45',
  // Refinement 2026-11-10 (BD-1 – BD-8): the new templates' parameters.
  day: 'Mon', check: 'the 1:15 check', pctText: '+3.96%', priceText: '$280.91', pctDecimal: '3.954943', target: 291.594, asOf: '2026-11-10T17:44:00Z', id: 'pos-1', hash: 'abc123', ref: 'stockThresholdInputs/snap-1' };
const paramsOf = (fn) => fn.toString().slice(fn.toString().indexOf('(') + 1, fn.toString().indexOf(')')).split(',').map((p) => p.trim()).filter(Boolean);
function templates() {
  const out = [];
  for (const [k, v] of Object.entries(BOMB_COPY)) {
    if (typeof v === 'string') { out.push([k, v]); continue; }
    const names = paramsOf(v);
    out.push([k, v(...names.map((n) => ARG[n]))]);
    if (names.includes('banked')) out.push([k, v(...names.map((n) => (n === 'banked' ? false : ARG[n])))]);
    if (names.includes('at')) out.push([k, v(...names.map((n) => (n === 'at' ? null : ARG[n])))]);
    if (names.includes('time')) out.push([k, v(...names.map((n) => (n === 'time' ? null : ARG[n])))]);
    if (names.includes('check')) out.push([k, v(...names.map((n) => (n === 'check' ? null : ARG[n])))]);
    // A downside template is called with downside points, as the views call it.
    if (/^(down|danger)/.test(k) && names.includes('points')) out.push([k, v(...names.map((n) => (n === 'points' ? -10 : ARG[n])))]);
  }
  return out;
}

// Rendered once per file (every forbidden-term row reads the same states; review 2026-11-11: re-rendering them per row ran past the 5 s row timeout).
let STATES_CACHE = null;
function renderedStates() {
  if (!STATES_CACHE) STATES_CACHE = computeRenderedStates();
  return STATES_CACHE;
}
function computeRenderedStates() {
  const ghost = [{ timestamp: Date.parse('2026-10-13T19:30:00.000Z') / 1000, close: 100.5 }, { timestamp: Date.parse('2026-10-14T14:00:00.000Z') / 1000, close: 101 }];
  const trace = traceParts([{ timestamp: Date.parse('2026-10-14T16:56:00.000Z') / 1000, close: 102.6 }, { timestamp: Date.parse('2026-10-14T16:57:00.000Z') / 1000, close: 102.7 }], [{ atMs: Date.parse('2026-10-14T16:59:00.000Z'), price: 102.71 }]);
  const clock = { state: 'countdown', label: '1:15 · 09:00' };
  const states = [];
  for (const ladder of [measured, preview, heldPreview, atrPreview, v4]) {
    const go = toGo(ladder, 102.7);
    const view = { ladder, go, live: 102.7, decimals: 2, mode: 'fuse', nowMs: Date.parse('2026-10-14T17:06:00.000Z'), clock, ghost, trace, checkDots: [], bankedTimes: { bagger: Date.parse('2026-10-14T17:15:00.000Z') }, moment: null, redZoneScored: scoredChipText({ live: 102.7, scored: { price: 102.69, atMs: Date.parse('2026-10-14T17:00:30.000Z') }, always: true }), sheetScored: null, sheetLine: sheetLine({ ladder, clockLabel: '1:15', decimals: 2, nowMs: Date.parse('2026-10-14T17:06:00.000Z') }) };
    states.push(renderToStaticMarkup(<FuseChart ladder={ladder} live={102.7} decimals={2} go={go} ghost={ghost} bankedTimes={view.bankedTimes} />));
    states.push(renderToStaticMarkup(<BombSheet view={view} />));
    for (const mode of ['approaching', 'banked', 'closed']) {
      states.push(renderToStaticMarkup(<RedZone ladder={ladder} go={go} live={102.7} decimals={2} mode={mode} trace={trace} clock={mode === 'closed' ? { state: 'later', label: 'Thu 9:30 AM' } : clock} scoredText={view.redZoneScored} moment={mode === 'banked' ? { key: 'bagger', atMs: Date.parse('2026-10-14T17:15:00.000Z'), price: 102.77 } : null} nowMs={view.nowMs} />));
      states.push(renderToStaticMarkup(<RedZoneChip mode={mode} />));
    }
  }
  // Refinement 2026-11-10: both directions — the downside drawn and leading, a rung hit (seen and unseen),
  // the Danger Zone live and closed, its chip, the levels table and the Details.
  const hitLadder = measuredLadder({ measured: { measured: true, baselinePrice: 100.75, targets: [['bagger', 102.765], ['doubleBagger', 103.7725], ['tenBagger', 104.78], ['bust', 98.735], ['crash', 97.7275], ['meltdown', 96.72]].map(([key, price]) => ({ key, price })), crossedTiers: ['bust'] }, entryAtMs: Date.parse('2026-10-13T13:45:00.000Z') });
  const details = { scoringPctDecimal: '2.000000', targets: hitLadder.rungs.map((r) => ({ key: r.key, label: r.label, target: r.price })), currentPrice: 97.9, providerAsOf: '2026-10-14T16:44:00.000Z', positionId: 'pos-1', receiptHash: 'abc123', inputRef: 'stockThresholdInputs/snap-1', modelId: 'stock_measured_atr14_fullday_v2' };
  for (const [hitTimes, live] of [[{ bust: Date.parse('2026-10-14T17:15:00.000Z') }, 97.9], [{}, 98.2], [{}, 101.4]]) {
    const go = toGo(hitLadder, live);
    const goDown = toGoDown(hitLadder, live);
    for (const lead of ['up', 'down']) {
      const view = { ladder: hitLadder, go, goDown, lead, live, decimals: 2, mode: 'fuse', nowMs: Date.parse('2026-10-14T17:16:00.000Z'), clock, ghost, trace, checkDots: [], bankedTimes: {}, hitTimes, details, moment: null, sheetScored: null, marketOpen: true, sheetLine: sheetLine({ ladder: hitLadder, clockLabel: '1:30', hitTimes, lead, decimals: 2 }) };
      states.push(renderToStaticMarkup(<FuseChart ladder={hitLadder} live={live} decimals={2} go={go} goDown={goDown} lead={lead} ghost={ghost} hitTimes={hitTimes} />));
      states.push(renderToStaticMarkup(<BombSheet view={view} />));
    }
    for (const mode of ['danger', 'dangerClosed']) {
      states.push(renderToStaticMarkup(<RedZone side="down" ladder={hitLadder} go={goDown} live={live} decimals={2} mode={mode} trace={trace} clock={clock} scoredText={scoredChipText({ live, scored: { price: 97.9, atMs: Date.parse('2026-10-14T16:44:00.000Z'), checkAtMs: Date.parse('2026-10-14T17:00:30.000Z') }, always: true })} hitTimes={hitTimes} nowMs={Date.parse('2026-10-14T17:16:00.000Z')} />));
      states.push(renderToStaticMarkup(<RedZoneChip mode={mode} />));
    }
  }
  // Review C11: every downside rung hit (the downside's own "every rung" state), both leads.
  const allHit = measuredLadder({ measured: { measured: true, baselinePrice: 100.75, targets: [['bagger', 102.765], ['doubleBagger', 103.7725], ['tenBagger', 104.78], ['bust', 98.735], ['crash', 97.7275], ['meltdown', 96.72]].map(([key, price]) => ({ key, price })), crossedTiers: ['bust', 'crash', 'meltdown'] } });
  for (const lead of ['up', 'down']) {
    const go = toGo(allHit, 96.4);
    const goDown = toGoDown(allHit, 96.4);
    states.push(renderToStaticMarkup(<FuseChart ladder={allHit} live={96.4} decimals={2} go={go} goDown={goDown} lead={lead} hitTimes={{ meltdown: Date.parse('2026-10-14T17:15:00.000Z') }} />));
    states.push(renderToStaticMarkup(<BombSheet view={{ ladder: allHit, go, goDown, lead, live: 96.4, decimals: 2, marketOpen: true, bankedTimes: {}, hitTimes: { meltdown: Date.parse('2026-10-14T17:15:00.000Z') }, sheetScored: null, sheetLine: sheetLine({ ladder: allHit, lead, decimals: 2 }) }} />));
  }
  for (const status of ['entry_unavailable', 'measured_unavailable', 'preview_unavailable', 'atr_unavailable', 'atr_loading', 'atr_failed', 'short_unsupported']) {
    states.push(renderToStaticMarkup(<BombPlot view={{ ladder: { status } }} height={300} />));
    states.push(renderToStaticMarkup(<BombSheet view={{ ladder: { status } }} />));
  }
  return states.map((html) => {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const labels = [...doc.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label'));
    return { html, text: [doc.body.textContent, ...labels].join(' \n ') };
  });
}

const SOURCES = readdirSync(HERE).filter((n) => /\.(js|jsx)$/.test(n) && !/\.test\./.test(n));
const codeOf = (f) => readFileSync(path.join(HERE, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('Bomb mode copy: no forbidden term anywhere it can reach a player', () => {
  it('every template is exercised: each of its parameters has a probe value, and each renders a string', () => {
    for (const [k, v] of Object.entries(BOMB_COPY)) {
      if (typeof v !== 'function') continue;
      for (const n of paramsOf(v)) expect(ARG, `${k}(${n})`).toHaveProperty(n);
    }
    for (const [k, s] of templates()) expect(typeof s, k).toBe('string');
  });
  it.each(ALL)('no template says "%s"', (term) => {
    for (const [k, s] of templates()) expect(hit(s, term), `${k}: ${s}`).toBe(false);
  });
  it.each(ALL)('no rendered view says "%s" (text and aria-labels, every state)', (term) => {
    for (const { text } of renderedStates()) expect(hit(text, term), text.slice(0, 200)).toBe(false);
  });
  it.each(ALL)('no BombMode source string says "%s" (comments stripped)', (term) => {
    for (const f of SOURCES) expect(hit(codeOf(f), term), f).toBe(false);
  });
});

describe('a preview never says "entry" (BA-1)', () => {
  it('the preview and V4 sheet lines and baseline labels', () => {
    for (const ladder of [preview, atrPreview, v4]) {
      const view = { ladder, go: toGo(ladder, 100), live: 100, decimals: 2, sheetLine: sheetLine({ ladder, decimals: 2 }), sheetScored: null };
      const fuse = renderToStaticMarkup(<FuseChart ladder={ladder} live={100} decimals={2} go={view.go} />);
      const sheet = renderToStaticMarkup(<BombSheet view={view} />);
      const text = new DOMParser().parseFromString(`<body>${fuse}${sheet}</body>`, 'text/html').body.textContent;
      expect(text).not.toMatch(/entr(y|ies|ed)\b(?! at yesterday)/i);
      expect(text).not.toMatch(/entry price/i);
      expect(text).toMatch(/preview/i);
    }
  });
  it('the only "entered" a preview carries is the conditional of its own label', () => {
    expect(BOMB_COPY.previewNeeds(99, 2)).toBe("Preview · rungs if it entered at yesterday's close ($99.00)");
    // BS-4: the ATR preview's line is the same line, then an estimate named as one, at the bench sheet's precision.
    expect(BOMB_COPY.previewNeedsAtr(99, 2, 4.05, '12:05 PM')).toBe("Preview · rungs if it entered at yesterday's close ($99.00) · estimated rung size · ATR reading 4.0% · as of 12:05 PM");
    expect(sheetLine({ ladder: atrPreview, decimals: 2, nowMs: Date.parse('2026-10-14T17:06:00.000Z') })).toBe(BOMB_COPY.previewNeedsAtr(99, 2, 4.05, '12:05 PM'));
  });
});

describe('a held legacy-scored position: the held wording (ruling 2026-11-07, §0.4(a) rule (i))', () => {
  it('the exact line, from BOMB_COPY', () => {
    expect(BOMB_COPY.heldPreviewNeeds(155.6, 2)).toBe("Held · rungs shown from yesterday's close ($155.60) · this position's live ladder isn't shown here");
    expect(sheetLine({ ladder: heldPreview, clockLabel: '1:15', decimals: 2 })).toBe(BOMB_COPY.heldPreviewNeeds(99, 2));
  });
  it('the rendered Fuse and sheet: held, never "entry" in any form (not even the preview\'s conditional), never "will bank", nothing banked', () => {
    const view = { ladder: heldPreview, go: toGo(heldPreview, 100), live: 100, decimals: 2, sheetLine: sheetLine({ ladder: heldPreview, clockLabel: '1:15', decimals: 2 }), sheetScored: null };
    const fuse = renderToStaticMarkup(<FuseChart ladder={heldPreview} live={100} decimals={2} go={view.go} bankedTimes={{ bagger: Date.parse('2026-10-14T17:15:00.000Z') }} />);
    const sheet = renderToStaticMarkup(<BombSheet view={view} />);
    const doc = new DOMParser().parseFromString(`<body>${fuse}${sheet}</body>`, 'text/html');
    const text = doc.body.textContent;
    expect(text).toContain("Held · rungs shown from yesterday's close ($99.00) · this position's live ladder isn't shown here");
    expect(text).not.toMatch(/entr(y|ies|ed)\b/i);
    expect(text).not.toMatch(/will\s+bank|a check decides/i);
    expect(text).not.toMatch(/banked|✓/i);
    expect(doc.querySelectorAll('[data-rung-banked="1"], [data-fuse-banked-at]')).toHaveLength(0);
  });
});

// The scan PARSES the component (acorn + acorn-jsx, as the repo's hub guards do;
// review C8 and its refuter: a regex missed text after an expression, a `>` alone
// on its line and text led by a colon). Inline copy is any word a JSX child
// carries itself: a JSXText, or a string / template literal as a child
// expression (directly, or as either branch of `?:` / the right of `&&` `||`).
const JsxParser = Parser.extend(acornJsx());
const WORD = /[A-Za-z]{2,}/;
function inlineCopy(code) {
  const found = [];
  const literalWords = (e) => {
    if (!e) return [];
    if (e.type === 'Literal' && typeof e.value === 'string') return WORD.test(e.value) ? [e.value.trim()] : [];
    if (e.type === 'TemplateLiteral') return e.quasis.map((q) => q.value.cooked).filter((s) => WORD.test(s)).map((s) => s.trim());
    if (e.type === 'ConditionalExpression') return [...literalWords(e.consequent), ...literalWords(e.alternate)];
    if (e.type === 'LogicalExpression') return literalWords(e.right);
    return [];
  };
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (typeof n.type !== 'string') return;
    if (n.type === 'JSXElement' || n.type === 'JSXFragment') {
      for (const c of n.children) {
        if (c.type === 'JSXText' && WORD.test(c.value)) found.push(c.value.trim());
        if (c.type === 'JSXExpressionContainer') found.push(...literalWords(c.expression));
      }
    }
    for (const [k, v] of Object.entries(n)) if (k !== 'loc' && k !== 'range' && v && typeof v === 'object') walk(v);
  };
  walk(JsxParser.parse(code, { ecmaVersion: 'latest', sourceType: 'module' }));
  return found;
}

describe('every visible word comes from BOMB_COPY', () => {
  it('the scan catches every planted form of inline copy, and passes copy taken from BOMB_COPY', () => {
    expect(inlineCopy('const a = <b>Entry {price}</b>;')).toEqual(['Entry']);
    expect(inlineCopy('const a = (<text x={1}>\n  Next check\n</text>);')).toEqual(['Next check']);
    expect(inlineCopy('const a = <text>{money(p, d)} target</text>;')).toEqual(['target']); // after an expression
    expect(inlineCopy('const a = (\n  <text\n    x={1}\n  >\n    30-min closes\n  </text>\n);')).toEqual(['30-min closes']); // `>` alone on its line
    expect(inlineCopy('const a = <g><Tag />: held since entry</g>;')).toEqual([': held since entry']); // led by a colon
    expect(inlineCopy("const a = <b>{'Your position'}</b>;")).toEqual(['Your position']);
    expect(inlineCopy("const a = <b>{on ? 'Live' : null}</b>;")).toEqual(['Live']);
    expect(inlineCopy('const a = <b>{BOMB_COPY.entry(p)}</b>;')).toEqual([]);
    expect(inlineCopy("const a = x ? <g></g>\n  : r.state === 'next'\n  ? <b /> : null;")).toEqual([]);
    expect(inlineCopy('const a = <text fontSize="8.5" textAnchor="end" style={{ fill: BT.gold }}>{label}</text>;')).toEqual([]);
  });
  it.each(SOURCES.filter((f) => f.endsWith('.jsx')))('%s types no copy inline in JSX', (f) => {
    expect(inlineCopy(readFileSync(path.join(HERE, f), 'utf8'))).toEqual([]);
  });
});

// Refinement 2026-11-10 — BD-10: the both-directions copy.
describe('BD-10 — both directions: a crossed downside rung is "hit", never "banked"', () => {
  // BY CONSTRUCTION: bombCopy.js keys every downside template `down…` or `danger…`
  // (its NAMING RULE), and the views tag every downside node data-side="down" /
  // data-level-side="down" / the Danger Zone view — so these rows enumerate them,
  // they do not list them by hand.
  const DOWN_KEY = /^(down|danger)/;
  it('the downside templates exist under the naming rule (the enumeration is not empty)', () => {
    const keys = Object.keys(BOMB_COPY).filter((k) => DOWN_KEY.test(k));
    expect(keys.length).toBeGreaterThanOrEqual(15);
    expect(keys).toEqual(expect.arrayContaining(['downHitTitle', 'downLevelHit', 'downHitAt', 'downHitLine', 'dangerZoneChip', 'downToGoBricks']));
  });
  it('no downside template says "banked" (every argument variant)', () => {
    for (const [k, s] of templates()) if (DOWN_KEY.test(k)) expect(s, `${k}: ${s}`).not.toMatch(/bank/i);
  });
  it('no rendered downside node says "banked": the Fuse\'s and the bar\'s downside rungs, the table\'s downside rows, the pills and to-go spans, the Danger Zone view', () => {
    // Each KIND is counted (review C11: a dropped tag must fail here, not silently shrink the scan).
    const KINDS = {
      fuseRung: '[data-fuse-rung][data-side="down"]', fuseLabel: '[data-fuse-down]', barRung: '[data-sheet-rung][data-side="down"]',
      tableRow: '[data-level-side="down"]', pill: '[data-fuse-togo="down"]', togo: '[data-sheet-togo-lead="down"], [data-sheet-togo-other="down"]',
      zone: '[data-bomb-view="dangerzone"]', chip: '[data-bomb-zone-chip="danger"]',
    };
    const counts = Object.fromEntries(Object.keys(KINDS).map((k) => [k, 0]));
    for (const { html } of renderedStates()) {
      const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
      for (const [kind, sel] of Object.entries(KINDS)) for (const el of doc.querySelectorAll(sel)) {
        counts[kind] += 1;
        expect(el.textContent, `${kind}: ${el.outerHTML.slice(0, 160)}`).not.toMatch(/bank/i);
        for (const a of el.getAttributeNames()) expect(`${a}=${el.getAttribute(a)}`).not.toMatch(/bank/i);
      }
    }
    for (const [kind, n] of Object.entries(counts)) expect(n, kind).toBeGreaterThanOrEqual(kind === 'zone' || kind === 'chip' ? 2 : 6);
  });
  it('every rung below hit says so in words (review C11, A9) — and never "banked"', () => {
    const texts = renderedStates().map((s) => s.text).filter((t) => t.includes(BOMB_COPY.downEveryRungHit) || t.includes(BOMB_COPY.downEveryRungHit.toUpperCase()));
    expect(texts.length).toBeGreaterThanOrEqual(2);
  });
  it('every new data- attribute on a downside node names it "hit" — none says "banked"', () => {
    const src = ['FuseChart.jsx', 'BombSheet.jsx', 'RedZone.jsx', 'BombPlot.jsx'].map(codeOf).join('\n');
    const attrs = [...src.matchAll(/data-[a-z-]+/g)].map((m) => m[0]);
    expect(attrs).toEqual(expect.arrayContaining(['data-down-hit', 'data-rung-hit']));
    expect(attrs.filter((a) => /down|danger|hit/.test(a) && /bank/.test(a))).toEqual([]);
  });
});

describe('BD-10 — the rest of the both-directions copy rules', () => {
  it('no template says "will" (no forecast; scoreboard language only)', () => {
    for (const [k, s] of templates()) expect(hit(s, 'will'), `${k}: ${s}`).toBe(false);
  });
  it('"Danger zone" is the only new name: every zone the copy names is the red zone or the Danger zone', () => {
    const names = new Set(templates().flatMap(([, s]) => [...s.matchAll(/\b([A-Za-z]+)\s+zone\b/gi)].map((m) => m[0])));
    expect([...names].sort()).toEqual(['Danger zone', 'Red zone']);
    expect(BOMB_COPY.dangerZoneChip).toBe('Danger zone');
  });
  it('review A3: the Danger Zone view is named as itself for a screen reader, never "Red zone"', () => {
    const ladder = measuredLadder({ measured: { measured: true, baselinePrice: 100, targets: [['bagger', 102], ['doubleBagger', 103], ['tenBagger', 104], ['bust', 98], ['crash', 97], ['meltdown', 96]].map(([key, price]) => ({ key, price })), crossedTiers: [] } });
    const html = renderToStaticMarkup(<RedZone side="down" ladder={ladder} go={toGoDown(ladder, 98.3)} live={98.3} decimals={2} mode="danger" trace={traceParts([], [])} clock={null} scoredText={null} nowMs={Date.parse('2026-10-14T17:16:00.000Z')} />);
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const label = doc.querySelector('[data-bomb-view="dangerzone"] svg').getAttribute('aria-label');
    expect(label).toBe(BOMB_COPY.dangerAriaZone);
    expect(label).not.toMatch(/red zone/i);
  });
  it('no agent verb in any new template (the Desk guard\'s list, on the downside templates by name)', () => {
    for (const [k, s] of templates()) if (/^(down|danger|level|details|needsFor|upNeeds|checkName|toGoShort|seeAllLevels)/.test(k)) for (const term of DESK_FORBIDDEN) expect(hit(s, term), `${k}: ${s}`).toBe(false);
  });
  it('a preview\'s levels table carries no state and never says "entry"', () => {
    const view = { ladder: preview, go: toGo(preview, 100.4), goDown: toGoDown(preview, 100.4), lead: 'up', live: 100.4, decimals: 2, sheetLine: sheetLine({ ladder: preview, decimals: 2 }), sheetScored: null, bankedTimes: {}, hitTimes: {} };
    const doc = new DOMParser().parseFromString(`<body>${renderToStaticMarkup(<BombSheet view={view} />)}</body>`, 'text/html');
    const table = doc.querySelector('[data-bomb-levels]');
    expect(table.querySelector('[data-bomb-levels-preview]').textContent).toBe(BOMB_COPY.levelsPreview);
    expect([...table.querySelectorAll('[data-level-state]')].map((e) => e.getAttribute('data-level-state'))).toEqual(Array(7).fill('none'));
    expect(table.textContent).not.toMatch(/entr(y|ies|ed)\b/i);
  });
});
