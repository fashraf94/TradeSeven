// src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx
//
// Shared by the Film Room v2 screen suites (jsdom): mounting, and the sweeps
// that turn Amendment E's exit criterion into rows —
//   sweepNumbers   BA-42 / F2 / BUILD_RULES §9: every rendered number carries
//                  the marker of ITS OWN path's declared class (read from the
//                  document's numberClasses), its text is the document's value,
//                  and no digit appears outside a marked number, an instant, an
//                  identifier or the record's own stored text
//   sweepWords     no verdict, ranking or forbidden word; no "Why?" heading
//   sweepSigns     sign colours on recorded scores only
// The fixtures are the A1 passes' own output (screenFixtures.test.js).

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { classOfNumber } from '../../../constants/filmTape';
import { COMPANY_NAMES } from '../../../config/stockData';
import { valueAt } from '../filmRoomModel';
import sep23Tape from './sep23.tape.json';
import sep23Series from './sep23.series.json';
import emptyTape from './empty.tape.json';
import emptySeries from './empty.series.json';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export { sep23Tape, sep23Series, emptyTape, emptySeries };
export const clone = (v) => JSON.parse(JSON.stringify(v));
export const NOW = Date.parse('2026-10-08T15:00:00.000Z');

export function battleOf(tape, over = {}) {
  return { id: tape.battleId, status: 'completed', completedAt: tape.battle?.completedAt ?? null, timing: { tradingDays: [tape.etDate] }, agentContext: { agentName: 'Momentum chaser', archetype: 'momentum_chaser' }, ...over };
}

export function readersOf(tapesByDate, series = []) {
  const calls = [];
  return {
    calls,
    readTape: async (battleId, etDate) => { calls.push(['tape', battleId, etDate]); const t = tapesByDate[etDate]; return t ? { status: 'ready', tape: t } : { status: 'missing', tape: null }; },
    readSeries: async (battleId, etDate, ownerId) => { calls.push(['series', battleId, etDate, ownerId]); return { status: 'ready', series }; },
  };
}

export function mounter() {
  const m = { container: null, root: null };
  m.setup = () => {
    m.container = document.createElement('div');
    document.body.appendChild(m.container);
    m.root = createRoot(m.container);
  };
  m.teardown = () => { act(() => m.root.unmount()); m.container.remove(); };
  m.render = (el) => act(() => { m.root.render(el); });
  m.flush = async (n = 6) => { for (let i = 0; i < n; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
  m.click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  m.q = (sel) => m.container.querySelector(sel);
  m.qa = (sel) => [...m.container.querySelectorAll(sel)];
  m.tab = (label) => m.qa('[role="tab"]').find((b) => b.textContent === label);
  m.buttons = (text) => m.qa('button').filter((b) => b.textContent.trim() === text);
  /** Open everything that opens: collapsed text, the recorded words, the explainer. */
  m.expandAll = () => {
    for (const label of ['Read more', 'Show the recorded words', 'How a directive card reads']) {
      for (const b of m.buttons(label)) m.click(b);
    }
  };
  return m;
}

/** "checks[3].scores.total" → ['checks', 3, 'scores', 'total']. */
export function parsePath(s) {
  const out = [];
  for (const part of s.split('.')) {
    const m = part.match(/^([^[\]]*)((?:\[\d+\])*)$/);
    if (m[1]) out.push(m[1]);
    for (const idx of m[2].match(/\d+/g) || []) out.push(Number(idx));
  }
  return out;
}

/** The number a rendered numeral stands for ('−1.5' → -1.5, '+9' → 9, '1,234.50' → 1234.5). */
export function parseNumeral(text) {
  return Number(String(text).replace(/−/g, '-').replace(/[+,%\s]/g, ''));
}

/** Every string a document stores (values and map keys) — what the record's own text may be. */
function storedStrings(docs) {
  const out = new Set();
  const walk = (v) => {
    if (typeof v === 'string') out.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); walk(x); }
  };
  docs.forEach(walk);
  return [...out].filter((s) => /\d/.test(s)).sort((a, b) => b.length - a.length);
}

const TIME_PATTERNS = [/\b\d{1,2}:\d{2}( (AM|PM))?\b/g, /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}\b/g, /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b/g, /\d{4}-\d{2}-\d{2}T[\d:.]+Z/g];
/** The fixed copy that spells a digit: the class labels' bar widths, the quote-delay note, an evidence field's name. */
export const FIXED_DIGIT_COPY = ['1-minute', '10-minute', '15–20 minutes', 'nr7'];

/**
 * The class of every number the screen computes, PINNED HERE from Amendment E's addendum R4(a) — never read
 * from production's SCREEN_AGGREGATE_CLASSES, so a wrong declaration there cannot pass by agreeing with
 * itself (the SPEC_FORBIDDEN_WORDS precedent, review A2L4-7). filmRoomModel's table is pinned equal to it.
 */
export const SPEC_AGGREGATE_CLASSES = Object.freeze({
  'count(checks[] in a run)': 'derived',
  'count(slots of the derived held set)': 'derived',
  'count(actions[])': 'derived',
  'count(checks[] with a record)': 'derived',
  'count(tickSeqs in the minted range)': 'derived',
  'count(rationale[])': 'derived',
  'count(plans[] of the symbol)': 'derived',
  'ordinal(actions[] in time order)': 'derived',
  'change(sessionOpen.value to bars[last].c)': 'market',
  'sum(bars[].v)': 'market',
  'axis(% from the session open)': 'market',
});

/** R4(d): a display name is exempt only as the directory's own entry for its symbol, letter for letter. */
const isDirectoryName = (el) => {
  const host = el.closest('[data-display-name]');
  return Boolean(host) && COMPANY_NAMES[host.getAttribute('data-display-name')] === host.textContent;
};

/**
 * R4(b): the axes whose tick labels may go unmarked — those with EXACTLY ONE caption, carrying ONE marker of the
 * class the axis's source declares (the series document's declaration for its path, or the oracle's for a computed
 * axis). Tick labels are scaffolding only when explicitly marked [data-axis-scaffolding] inside the price chart.
 */
export function axisDefects(container, docs) {
  const bad = [];
  const ok = new Set();
  const axes = new Set();
  for (const el of container.querySelectorAll('[data-axis-scaffolding]')) {
    axes.add(el.getAttribute('data-axis-scaffolding'));
    if (!el.closest('[data-region="price-chart"]')) bad.push(`axis scaffolding outside the chart: “${el.textContent}”`);
    if (el.querySelector('[data-num], [data-num-aggregate], [data-kind-mark]')) bad.push(`axis scaffolding holds a marked number: “${el.textContent}”`);
  }
  for (const axis of axes) {
    const caps = [...container.querySelectorAll(`[data-axis-caption="${axis}"]`)];
    if (caps.length !== 1) { bad.push(`axis ${axis}: ${caps.length} captions`); continue; }
    const cap = caps[0];
    const marks = [...cap.querySelectorAll('[data-kind-mark]')].map((k) => k.getAttribute('data-kind-mark'));
    const doc = docs[cap.getAttribute('data-axis-doc')];
    const want = cap.hasAttribute('data-axis-aggregate')
      ? SPEC_AGGREGATE_CLASSES[cap.getAttribute('data-axis-aggregate')] ?? null
      : (doc ? classOfNumber(doc.numberClasses, parsePath(cap.getAttribute('data-axis-path') || '')) : null);
    if (marks.length !== 1 || !want || marks[0] !== want) { bad.push(`axis ${axis}: caption marker ${marks.join('+') || 'none'}, declared ${want}`); continue; }
    ok.add(axis);
  }
  return { bad, ok };
}

/**
 * BA-42 sweep over a mounted container. `docs` maps a `data-num-doc` label to
 * its document ('tape', 'series:SYM'). Returns the list of defects (empty when
 * every number is marked by its own path's class and no digit strays).
 */
export function sweepNumbers(container, docs) {
  const bad = [];
  const allDocs = Object.values(docs);
  for (const el of container.querySelectorAll('[data-num]')) {
    const doc = docs[el.getAttribute('data-num-doc')];
    const where = el.getAttribute('data-num');
    if (!doc) { bad.push(`unknown document for ${where}`); continue; }
    const path = parsePath(where);
    const want = classOfNumber(doc.numberClasses, path);
    const got = el.getAttribute('data-num-class');
    const mark = el.querySelector('[data-kind-mark]')?.getAttribute('data-kind-mark');
    if (!want) bad.push(`${where}: no declared class`);
    if (got !== want || mark !== want) bad.push(`${where}: shows ${got}/${mark}, declared ${want}`);
    const value = valueAt(doc, path);
    const shown = parseNumeral(el.querySelector('[data-num-text]')?.textContent);
    if (!(typeof value === 'number' && Math.abs(shown - value) < 0.0051)) bad.push(`${where}: shows ${shown}, the document holds ${value}`);
  }
  for (const el of container.querySelectorAll('[data-num-aggregate]')) {
    const want = SPEC_AGGREGATE_CLASSES[el.getAttribute('data-num-aggregate')];
    const mark = el.querySelector('[data-kind-mark]')?.getAttribute('data-kind-mark');
    if (!want || el.getAttribute('data-num-class') !== want || mark !== want) bad.push(`aggregate ${el.getAttribute('data-num-aggregate')}: marker ${mark}, declared ${want}`);
  }
  const stored = storedStrings(allDocs);
  const axes = axisDefects(container, docs);
  bad.push(...axes.bad);
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let text = node.textContent;
    if (!/\d/.test(text)) continue;
    const host = node.parentElement;
    // A numeral is exempt only inside a MARKED number (review A2L4-6: a bare data-num-text span is not one).
    if (host.closest('[data-num-text]') && (host.closest('[data-num]') || host.closest('[data-num-aggregate]'))) continue;
    // R4(b): an axis tick label, explicitly marked as scaffolding, of an axis whose one caption names its declared class.
    const tick = host.closest('[data-axis-scaffolding]');
    if (tick && axes.ok.has(tick.getAttribute('data-axis-scaffolding'))) continue;
    // R4(d): the directory's own name for the symbol (“Phillips 66”), never anything else in a display-name element.
    if (isDirectoryName(host)) continue;
    if (host.closest('[data-time]')) for (const re of TIME_PATTERNS) text = text.replace(re, ' ');
    if (host.closest('[data-identifier]')) text = text.replace(/#swap-\d+/g, ' ');
    if (host.closest('[data-record-text]')) for (const s of stored) text = text.split(s).join(' ');
    for (const s of FIXED_DIGIT_COPY) text = text.split(s).join(' ');
    if (/\d/.test(text)) bad.push(`stray digit: “${node.textContent.trim().slice(0, 80)}”`);
  }
  // Attributes a screen reader or a hover shows are rendered output too (review A2L4-6).
  for (const el of container.querySelectorAll('[aria-label], [title]')) {
    for (const attr of ['aria-label', 'title']) {
      let text = el.getAttribute(attr);
      if (!text || !/\d/.test(text)) continue;
      for (const re of TIME_PATTERNS) text = text.replace(re, ' ');
      for (const s of stored) text = text.split(s).join(' ');
      for (const s of FIXED_DIGIT_COPY) text = text.split(s).join(' ');
      if (/\d/.test(text)) bad.push(`stray digit in ${attr}: “${el.getAttribute(attr).slice(0, 80)}”`);
    }
  }
  return bad;
}

/**
 * The build prompt's forbidden words, PINNED HERE — never read from the production copy, so the oracle
 * cannot drift with the thing it checks (review A2L4-7). filmRoomCopy's list is pinned equal to it.
 */
export const SPEC_FORBIDDEN_WORDS = Object.freeze(['biggest', 'best', 'worst', 'mistake', 'should have', 'missed', 'good trade', 'bad trade', 'lesson', 'grade']);

/**
 * Every text node and every aria-label / title, each its own span of text: an element's edge is a word boundary
 * (review A2L4-1). A company's name from the directory is a proper noun, not the screen's words (R4(d): "Best Buy").
 */
export function renderedText(container) {
  const parts = [];
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if (!isDirectoryName(node.parentElement)) parts.push(node.textContent);
  for (const el of container.querySelectorAll('[aria-label], [title]')) parts.push(el.getAttribute('aria-label') || '', el.getAttribute('title') || '');
  return parts.join(' \n ');
}

/** No verdict, ranking or forbidden word (or its inflection), and no "Why" heading, anywhere in the rendered output. */
export function sweepWords(container) {
  const text = renderedText(container).toLowerCase();
  const hits = SPEC_FORBIDDEN_WORDS.filter((w) => new RegExp(`\\b${w.replace(/ /g, '\\s+')}(s|es|d|ed|ing)?\\b`).test(text));
  if (/\bwhy\s*\?/i.test(text)) hits.push('Why?');
  for (const h of container.querySelectorAll('h1, h2, h3, h4, h5, h6')) if (/^\s*why\b/i.test(h.textContent)) hits.push(`heading: ${h.textContent.trim()}`);
  return hits;
}

/**
 * Sign colours only on recorded scores (BA-41): ANY element whose style carries the success or danger
 * token, in any form (var(), the -rgb triplet, a background, an SVG stroke), must be a recorded score's
 * own number — never another class, a plan price, a wrapper, a line or a marker (review A2L4-8).
 */
export function sweepSigns(container) {
  const bad = [];
  for (const el of container.querySelectorAll('[style]')) {
    const style = el.getAttribute('style') || '';
    if (!/--ft-(success|danger)/.test(style)) continue;
    const where = el.getAttribute('data-num');
    if (!where) { bad.push(`sign colour on a ${el.tagName.toLowerCase()}${el.hasAttribute('data-kind-mark') ? ' marker' : ''}${el.getAttribute('data-line') ? ` line ${el.getAttribute('data-line')}` : ''}`); continue; }
    if (el.getAttribute('data-num-class') !== 'recorded') bad.push(`${where}: sign colour on a ${el.getAttribute('data-num-class')} number`);
    else if (/^plans\[/.test(where)) bad.push(`${where}: sign colour on a plan price`);
    else if (el.getAttribute('data-sign-color') !== 'yes') bad.push(`${where}: sign colour on a recorded number that is not a score`);
  }
  return bad;
}
