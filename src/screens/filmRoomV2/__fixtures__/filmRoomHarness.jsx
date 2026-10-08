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
import { FORBIDDEN_WORDS } from '../filmRoomCopy';
import { SCREEN_AGGREGATE_CLASSES, valueAt } from '../filmRoomModel';
import sep23Tape from './sep23.tape.json';
import sep23Series from './sep23.series.json';
import emptyTape from './empty.tape.json';
import emptySeries from './empty.series.json';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export { sep23Tape, sep23Series, emptyTape, emptySeries };
export const clone = (v) => JSON.parse(JSON.stringify(v));
export const NOW = Date.parse('2026-10-08T15:00:00.000Z');

export function battleOf(tape, over = {}) {
  return { id: tape.battleId, status: 'completed', completedAt: tape.battle?.completedAt ?? null, timing: { tradingDays: [tape.etDate] }, agentContext: { agentName: 'Momentum chaser' }, ...over };
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
    const want = SCREEN_AGGREGATE_CLASSES[el.getAttribute('data-num-aggregate')];
    const mark = el.querySelector('[data-kind-mark]')?.getAttribute('data-kind-mark');
    if (!want || el.getAttribute('data-num-class') !== want || mark !== want) bad.push(`aggregate ${el.getAttribute('data-num-aggregate')}: marker ${mark}, declared ${want}`);
  }
  const stored = storedStrings(allDocs);
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let text = node.textContent;
    if (!/\d/.test(text)) continue;
    const host = node.parentElement;
    if (host.closest('[data-num-text]') || host.closest('[data-num-aggregate]')) continue;
    if (host.closest('[data-time]')) for (const re of TIME_PATTERNS) text = text.replace(re, ' ');
    if (host.closest('[data-identifier]')) text = text.replace(/#swap-\d+/g, ' ');
    if (host.closest('[data-record-text]')) for (const s of stored) text = text.split(s).join(' ');
    for (const s of FIXED_DIGIT_COPY) text = text.split(s).join(' ');
    if (/\d/.test(text)) bad.push(`stray digit: “${node.textContent.trim().slice(0, 80)}”`);
  }
  return bad;
}

/** No verdict, ranking or forbidden word, and no "Why?" heading, anywhere in the rendered text. */
export function sweepWords(container) {
  const text = container.textContent.toLowerCase();
  const hits = FORBIDDEN_WORDS.filter((w) => new RegExp(`\\b${w.replace(/ /g, '\\s+')}\\b`).test(text));
  if (/why\?/i.test(container.textContent)) hits.push('Why?');
  return hits;
}

/** Sign colours only on recorded scores; never on another class, a plan price, or a marker. */
export function sweepSigns(container) {
  const bad = [];
  for (const el of container.querySelectorAll('[data-num]')) {
    const style = el.getAttribute('style') || '';
    const signColoured = /var\(--ft-(success|danger)\)/.test(style);
    const where = el.getAttribute('data-num');
    if (signColoured && el.getAttribute('data-num-class') !== 'recorded') bad.push(`${where}: sign colour on a ${el.getAttribute('data-num-class')} number`);
    if (signColoured && /^plans\[/.test(where)) bad.push(`${where}: sign colour on a plan price`);
  }
  for (const el of container.querySelectorAll('[data-kind-mark]')) {
    if (/var\(--ft-(success|danger)\)/.test(el.getAttribute('style') || '') && el.getAttribute('data-kind-mark') !== 'none') bad.push('a marker in a sign colour');
  }
  return bad;
}
