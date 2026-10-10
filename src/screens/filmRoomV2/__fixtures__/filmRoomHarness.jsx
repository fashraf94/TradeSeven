// src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx
//
// Shared by the Film Room v2 screen suites (jsdom): mounting, and the sweeps
// that turn Amendment E's exit criterion into rows —
//   sweepNumbers   BA-42 / F2 / BUILD_RULES §9: every rendered number carries
//                  the marker of ITS OWN path's declared class (read from the
//                  document's numberClasses), its text is the document's value,
//                  and no digit appears outside a marked number, an instant, an
//                  #swap-n anchor or a stored note BOUND to an R1 / R9 path
//                  (Astra B2: by binding, never by a string match)
//   storedNoteDefects  every stored note's text is the value at its path
//   sweepWords     the screen's own voice — everything outside a bound
//                  quotation (Amendment E addendum 2, R7): no verdict, ranking
//                  or forbidden word; no "Why?" heading; no number spelled
//                  as a word outside a marked number (R8)
//   quoteDefects   R7's guard: every quotation bound to its tape path (text =
//                  the stored value), attributed as the record says, and never
//                  inside a heading (Astra B1)
//   sweepSigns     sign colours on recorded scores only
// The fixtures are the A1 passes' own output (screenFixtures.test.js).

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { classOfNumber } from '../../../constants/filmTape';
import { COMPANY_NAMES } from '../../../config/stockData';
import { valueAt, etClock, tradingTimeline } from '../filmRoomModel';
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
    for (const label of ['Read more', 'How a directive card reads']) {
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

/**
 * Amendment E addendum 2, R8 — a spelled-out quantity is a number. The quantity words the screen's own voice may
 * not spell outside a marked number, PINNED HERE from the follow-up prompt (Astra B3, a CLOSED list): the cardinals
 * zero to ninety (zero to twenty and the tens — a compound like "twenty-one" is two of them), hundred, thousand,
 * million, billion, dozen, single, half, double, triple, twice; with the value each stands for. Inflected forms
 * bite too ("dozens", "sixes", "halves"). R12's "shown once" is not a quantity claim and is not on the list.
 */
const CARDINALS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TENS = ['thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export const SPEC_NUMBER_WORDS = Object.freeze([...CARDINALS, ...TENS, 'hundred', 'thousand', 'million', 'billion', 'dozen', 'single', 'half', 'double', 'triple', 'twice']);
const NUMBER_WORD_VALUE = Object.freeze({
  ...Object.fromEntries(CARDINALS.map((w, i) => [w, i])),
  ...Object.fromEntries(TENS.map((w, i) => [w, 30 + 10 * i])),
  hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9, dozen: 12, single: 1, half: 0.5, double: 2, triple: 3, twice: 2,
});
const NUMBER_WORD = new RegExp(`\\b(${SPEC_NUMBER_WORDS.join('|')}|halves)(s|es)?\\b`, 'i');

/** The number a rendered numeral stands for ('−1.5' → -1.5, '+9' → 9, '1,234.50' → 1234.5, 'one' → 1). */
export function parseNumeral(text) {
  const word = String(text).trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORD_VALUE, word)) return NUMBER_WORD_VALUE[word];
  return Number(String(text).replace(/−/g, '-').replace(/[+,%\s]/g, ''));
}

/**
 * R1 / R9 — the stored-note paths whose numbers (digits and number words) are the tape's own words, PINNED HERE from
 * the rulings (never read from the screen): the stored coverage notes, the missing-input lists (each name at its own
 * index), and each replay's stored `label`. Astra B2: the exemption is a BINDING, the R7 discipline — an element
 * carrying `data-stored-note` at one of these paths whose text equals, byte for byte, the value its document stores
 * there. A string found anywhere else in the document exempts nothing.
 */
export const SPEC_STORED_NOTE_PATHS = Object.freeze([
  /^coverage\.[A-Za-z]+\.note$/,
  /^actions\[\d+\]\.replay\.reconciliation\.(soldAtSale|boughtAtSale)\.missingInputs\[\d+\]$/,
  /^plans\[\d+\]\.price\.missingInputs\[\d+\]$/,
  /^actions\[\d+\]\.replay\.label$/,
]);

/** The stored-note element `node` sits in when its text is the value its document stores at its path, or null. */
function storedNoteTextOf(node, docs) {
  const el = node?.nodeType === 1 ? node : node?.parentElement;
  const s = el?.closest('[data-stored-note]');
  if (!s) return null;
  const doc = docs[s.getAttribute('data-stored-doc') || 'tape'];
  if (!doc) return null;
  const value = valueAt(doc, parsePath(s.getAttribute('data-stored-note')));
  return typeof value === 'string' && value !== '' && s.textContent === value ? s : null;
}

/**
 * Amendment E addendum 4, R13 — the agent's name, PINNED HERE from the ruling: the stored display name at
 * agentContext.agentName on the battle document. It is exempt from the sweeps — forbidden words and number words, and
 * (as a bound quotation is, R7) digits — on its BINDING alone: an element carrying `data-agent-name` at exactly that
 * path whose text equals, byte for byte, the value the battle document stores there.
 */
export const SPEC_AGENT_NAME_PATH = 'agentContext.agentName';
export function boundAgentNameOf(node, docs = {}) {
  const el = node?.nodeType === 1 ? node : node?.parentElement;
  const n = el?.closest('[data-agent-name]');
  if (!n || n.getAttribute('data-agent-name') !== SPEC_AGENT_NAME_PATH) return null;
  const doc = docs[n.getAttribute('data-agent-name-doc') || 'battle'];
  const value = doc ? valueAt(doc, parsePath(SPEC_AGENT_NAME_PATH)) : undefined;
  return typeof value === 'string' && value !== '' && n.textContent === value ? n : null;
}

/** R13's guard: every agent-name element is bound to the stored name; and the name sits in no text-bearing attribute. */
export function agentNameDefects(container, docs = {}) {
  const bad = [];
  for (const n of container.querySelectorAll('[data-agent-name]')) if (!boundAgentNameOf(n, docs)) bad.push(`agent name “${n.textContent}”: not bound to ${SPEC_AGENT_NAME_PATH}`);
  const name = docs.battle ? valueAt(docs.battle, parsePath(SPEC_AGENT_NAME_PATH)) : null;
  if (typeof name === 'string' && name) {
    for (const el of container.querySelectorAll(TEXT_ATTRIBUTE_SELECTOR)) for (const attr of TEXT_ATTRIBUTES) if ((el.getAttribute(attr) || '').includes(name)) bad.push(`agent name in ${attr}: “${el.getAttribute(attr).slice(0, 80)}”`);
  }
  return bad;
}

/** B2 — the numbers of a stored note are exempt only when it is bound (above) AND its path is one R1 / R9 names. */
export function boundStoredNoteOf(node, docs = {}) {
  const s = storedNoteTextOf(node, docs);
  return s && SPEC_STORED_NOTE_PATHS.some((re) => re.test(s.getAttribute('data-stored-note'))) ? s : null;
}

/** Every stored note whose text is not the value at its path — screen words inside it, or a forged path. */
export function storedNoteDefects(container, docs = {}) {
  const bad = [];
  for (const s of container.querySelectorAll('[data-stored-note]')) {
    if (!storedNoteTextOf(s, docs)) bad.push(`${s.getAttribute('data-stored-note')}: not bound — its text is not the stored value`);
  }
  return bad;
}

/**
 * Every attribute whose text a reader is shown or read aloud — a hover title, an accessible name or description, an
 * image's alt, a field's placeholder. The sweeps read all of them, and recorded words may sit in none of them (R7's
 * guard: "copies recorded text into no other element or attribute"; review A2AV1-N1).
 */
export const TEXT_ATTRIBUTES = Object.freeze(['aria-label', 'title', 'aria-description', 'aria-roledescription', 'aria-valuetext', 'aria-placeholder', 'alt', 'placeholder']);
const TEXT_ATTRIBUTE_SELECTOR = TEXT_ATTRIBUTES.map((a) => `[${a}]`).join(', ');

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
  'count(timing.tradingDays)': 'derived',   // addendum 2, R8: the subtitle's battle length
  'change(sessionOpen.value to bars[last].c)': 'market',
  'sum(bars[].v)': 'market',
  'axis(% from the session open)': 'market',
});

/**
 * Where each computed number may sit (review A2P2-1): a declared aggregate anywhere else would be a recorded number
 * shown under a computed class, which the class check alone cannot see.
 */
export const SPEC_AGGREGATE_SITES = Object.freeze({
  'count(checks[] in a run)': '[data-region="check-runs"]',
  'count(slots of the derived held set)': '#holdings [data-section-count]',
  'count(actions[])': '#swaps [data-section-count]',
  'count(checks[] with a record)': '[data-section-count] [data-check-count]',
  'count(tickSeqs in the minted range)': '[data-section-count] [data-check-count]',
  'count(rationale[])': '#rationale [data-section-count]',
  'count(plans[] of the symbol)': '[data-region="plan-chips"] button',
  'ordinal(actions[] in time order)': '[data-swap-card] [data-swap-title]',
  'count(timing.tradingDays)': '[data-header-subtitle]',
  'change(sessionOpen.value to bars[last].c)': '[data-region="symbol-facts"]',
  'sum(bars[].v)': '[data-region="symbol-facts"]',
});

/** What a computed number's text says, and how far its format may round it: a count exactly, "+0.53%" to 0.005 %, "604K" to 500, "1.2M" to 50,000. */
function readShown(text) {
  const n = parseNumeral(text.replace(/[KM]$/, ''));
  if (/%$/.test(text)) return { value: n / 100, tolerance: 0.0000501 };
  if (/K$/.test(text)) return { value: n * 1e3, tolerance: 500.01 };
  if (/M$/.test(text)) return { value: n * 1e6, tolerance: 50_000.01 };
  return { value: n, tolerance: /\./.test(text) ? 0.0051 : 0 };
}

const NO_RECORD_STATES = ['deferred', 'no_record'];
const msOf = (v) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null);
const seriesDocAt = (el, docs) => docs[`series:${el.closest('[data-region="symbol-facts"]')?.getAttribute('data-symbol')}`] || null;

/**
 * Each computed number's value, recomputed HERE from the documents by what its name says it counts (review A2P2-1,
 * A2P2-5) — an independent oracle, never the screen's own helper. undefined → no oracle for this name (a run's count:
 * its rows bind it), null → the name has no value in these documents.
 */
function aggregateOracle(name, el, docs) {
  if (name === 'count(timing.tradingDays)') {
    // the battle document's own timeline, the days it names — read before any tape, since the header shows the length
    // while a day's tape is loading, missing or unreadable too (review A2A3-4, A2A3-8). Astra B4: through the ONE
    // validated reading the day picker and the count use (tradingTimeline) — by the prompt's instruction the oracle
    // shares that helper, a stated departure from this harness's "never read production" rule; the helper itself is
    // pinned by its own rows (filmRoomModel.test.js).
    const days = tradingTimeline(docs.battle);
    return days ? days.length : null;
  }
  const tape = docs.tape;
  if (!tape) return undefined;
  const checks = Array.isArray(tape.checks) ? tape.checks : [];
  const actions = Array.isArray(tape.actions) ? tape.actions : [];
  switch (name) {
    case 'count(actions[])': return actions.length;
    case 'count(rationale[])': return Array.isArray(tape.rationale) ? tape.rationale.length : 0;
    case 'count(checks[] with a record)': return checks.filter((r) => !NO_RECORD_STATES.includes(r.state)).length;
    case 'count(tickSeqs in the minted range)': {
      const close = tape.passes?.close || {};
      const seqs = [...(Array.isArray(close.tickSeqRange) ? close.tickSeqRange : []), ...(Array.isArray(close.gaps) ? close.gaps : [])];
      return seqs.length ? Math.max(...seqs) - Math.min(...seqs) + 1 : null;
    }
    case 'count(slots of the derived held set)': {
      const first = checks.find((c) => c.risk && typeof c.risk === 'object' && Object.keys(c.risk).length);
      return first ? Object.keys(first.risk).length : null;
    }
    case 'count(plans[] of the symbol)': {
      const sym = el.closest('button')?.querySelector('[data-record-text]')?.textContent;
      return (Array.isArray(tape.plans) ? tape.plans : []).filter((p) => p.symbol === sym).length;
    }
    case 'ordinal(actions[] in time order)': {
      const i = Number(el.closest('[data-swap-card]')?.getAttribute('data-swap-card'));
      const order = actions.map((a, k) => ({ k, ms: msOf(a.at) })).sort((x, y) => (x.ms === y.ms ? x.k - y.k : x.ms === null ? 1 : y.ms === null ? -1 : x.ms - y.ms));
      return order.findIndex((o) => o.k === i) + 1;
    }
    case 'change(sessionOpen.value to bars[last].c)': {
      const doc = seriesDocAt(el, docs);
      return doc ? doc.bars[doc.bars.length - 1].c / doc.sessionOpen.value - 1 : null;
    }
    case 'sum(bars[].v)': {
      const doc = seriesDocAt(el, docs);
      return doc ? doc.bars.reduce((sum, b) => sum + b.v, 0) : null;
    }
    default: return undefined;
  }
}

/**
 * The marked number's own text `host` sits in, or null: a `data-num-text` inside a marked number (`data-num` or
 * `data-num-aggregate`) that holds exactly ONE such text — a second one, or words beside the number, stay swept
 * (review A2A3-1).
 */
function markedNumberText(host) {
  const t = host.closest('[data-num-text]');
  const owner = t?.closest('[data-num], [data-num-aggregate]');
  return owner && owner.querySelectorAll('[data-num-text]').length === 1 ? t : null;
}

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
    const texts = el.querySelectorAll('[data-num-text]').length;
    if (texts !== 1) bad.push(`${where}: ${texts} number texts — a marked number holds exactly one (review A2A3-1)`);
    const value = valueAt(doc, path);
    const shown = parseNumeral(el.querySelector('[data-num-text]')?.textContent);
    if (!(typeof value === 'number' && Math.abs(shown - value) < 0.0051)) bad.push(`${where}: shows ${shown}, the document holds ${value}`);
  }
  for (const el of container.querySelectorAll('[data-num-aggregate]')) {
    const name = el.getAttribute('data-num-aggregate');
    const want = SPEC_AGGREGATE_CLASSES[name];
    const mark = el.querySelector('[data-kind-mark]')?.getAttribute('data-kind-mark');
    if (!want || el.getAttribute('data-num-class') !== want || mark !== want) bad.push(`aggregate ${name}: marker ${mark}, declared ${want}`);
    // its own site, the value it shows, and the value the documents give it (review A2P2-1, A2P2-5)
    if (!SPEC_AGGREGATE_SITES[name] || !el.closest(SPEC_AGGREGATE_SITES[name])) bad.push(`aggregate ${name}: outside its site`);
    const texts = el.querySelectorAll('[data-num-text]').length;
    if (texts !== 1) bad.push(`aggregate ${name}: ${texts} number texts — a marked number holds exactly one (review A2A3-1)`);
    const computed = Number(el.getAttribute('data-agg-value'));
    const text = el.querySelector('[data-num-text]')?.textContent || '';
    const shown = readShown(text);
    if (!(Math.abs(shown.value - computed) <= shown.tolerance)) bad.push(`aggregate ${name}: shows ${text}, computed ${computed}`);
    const oracle = aggregateOracle(name, el, docs);
    if (oracle !== undefined && !(typeof oracle === 'number' && Math.abs(oracle - computed) <= 1e-9 * Math.max(1, Math.abs(oracle)))) bad.push(`aggregate ${name}: computed ${computed}, the documents give ${oracle}`);
  }
  const axes = axisDefects(container, docs);
  bad.push(...axes.bad);
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let text = node.textContent;
    if (!/\d/.test(text)) continue;
    const host = node.parentElement;
    // A numeral is exempt only as a MARKED number's one text (review A2L4-6: a bare data-num-text span is not one; A2A3-1).
    if (markedNumberText(host)) continue;
    // R4(b): an axis tick label, explicitly marked as scaffolding, of an axis whose one caption names its declared class.
    const tick = host.closest('[data-axis-scaffolding]');
    if (tick && axes.ok.has(tick.getAttribute('data-axis-scaffolding'))) continue;
    // R4(d): the directory's own name for the symbol (“Phillips 66”), never anything else in a display-name element.
    if (isDirectoryName(host)) continue;
    // R1 / R7: a bound quotation's numbers are the record's own words, never a marked number's.
    if (boundQuotationOf(host, docs)) continue;
    // R1 / R9, Astra B2: a stored note's numbers are the tape's own words — only bound to an R1 / R9 path.
    if (boundStoredNoteOf(host, docs)) continue;
    // R13: the agent’s name, bound to its stored field, is a stored display name — not a number the screen states.
    if (boundAgentNameOf(host, docs)) continue;
    if (host.closest('[data-time]')) for (const re of TIME_PATTERNS) text = text.replace(re, ' ');
    if (host.closest('[data-identifier]')) text = text.replace(/#swap-\d+/g, ' ');
    for (const s of FIXED_DIGIT_COPY) text = text.split(s).join(' ');
    if (/\d/.test(text)) bad.push(`stray digit: “${node.textContent.trim().slice(0, 80)}”`);
  }
  // Attributes a screen reader or a hover shows are rendered output too (review A2L4-6; every one of them, A2AV1-N1).
  for (const el of container.querySelectorAll(TEXT_ATTRIBUTE_SELECTOR)) {
    for (const attr of TEXT_ATTRIBUTES) {
      let text = el.getAttribute(attr);
      if (!text || !/\d/.test(text)) continue;
      for (const re of TIME_PATTERNS) text = text.replace(re, ' ');
      // no stored-string exemption in an attribute: an attribute is always the screen's (R7; Astra B2)
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
 * Amendment E addendum 2, R7 — the recorded-words channels, PINNED HERE from the ruling (never read from the
 * screen): which tape paths hold someone's words, who they are as the tape records it ("the stored plan" /
 * "the stored directive" where it records no author), and the path of the record's own instant.
 */
const within = (p, key) => [...p.slice(0, 2), key];
export const SPEC_QUOTE_CHANNELS = Object.freeze([
  { re: /^rationale\[\d+\]\.(rationale|hypothesis)$/, by: 'the agent', at: (p) => within(p, 'at') },
  { re: /^directives\[\d+\]\.playerText$/, by: 'the player', at: (p) => within(p, 'filedAt') },
  { re: /^directives\[\d+\]\.agentReply$/, by: 'the agent', at: (p) => within(p, 'filedAt') },
  { re: /^directives\[\d+\]\.(canonicalText|retainedDirectiveText)$/, by: 'the stored directive', at: (p) => within(p, 'filedAt') },
  { re: /^plans\[\d+\]\.(signalSummary|threshold)$/, by: 'the stored plan', at: (p) => within(p, 'at') },
  { re: /^battle\.completionMessage\.text$/, by: 'the platform', at: () => ['battle', 'completionMessage', 'at'] },
]);

/**
 * The quotation element `node` sits in when it is BOUND to its path: it is the quotation component (its element
 * carries `data-quote-path` directly under a `data-quotation` root), and its text equals, byte for byte, the value
 * its document stores at that path. A forged path, screen copy inside a quotation, or a quotation of another value
 * is not bound.
 */
function boundTextOf(node, docs) {
  const el = node?.nodeType === 1 ? node : node?.parentElement;
  const q = el?.closest('[data-quote-path]');
  if (!q || !q.parentElement?.hasAttribute('data-quotation')) return null;
  const doc = docs[q.getAttribute('data-quote-doc') || 'tape'];
  if (!doc) return null;
  const value = valueAt(doc, parsePath(q.getAttribute('data-quote-path')));
  return typeof value === 'string' && value !== '' && q.textContent === value ? q : null;
}

/**
 * R7's guard — what the sweeps exempt: an ATTRIBUTED quotation bound to a tape path. All of: bound (above), a path
 * in the recorded-words channels, an attribution beside it (review A2A1-4: a bound quotation with no attribution,
 * or of a path that holds no one's words, stays under the sweeps), and NO heading around it (Astra B1: a heading is
 * the screen's own voice — recorded words inside one would read as the screen's title). Whether the attribution
 * names the right author and time is quoteDefects' check.
 */
const HEADINGS = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
export function boundQuotationOf(node, docs = {}) {
  const q = boundTextOf(node, docs);
  if (!q || !SPEC_QUOTE_CHANNELS.some((c) => c.re.test(q.getAttribute('data-quote-path')))) return null;
  if (q.closest(HEADINGS)) return null;
  return [...q.parentElement.children].some((c) => c.hasAttribute('data-quote-attribution')) ? q : null;
}

const ET_DAY_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const MONTH_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
/** The record's time as its attribution must read it: the ET clock, with the date when it is not the tape's day. */
function recordTime(instant, etDate) {
  const clock = etClock(instant);
  if (clock === null) return null;
  const day = ET_DAY_KEY.format(new Date(Date.parse(instant)));
  return etDate && day !== etDate ? `${MONTH_DAY.format(new Date(`${day}T12:00:00.000Z`))}, ${clock}` : clock;
}

/**
 * Every bound-quotation defect in a container (R7): a quote path whose text is not the stored value, a quotation
 * root without exactly one bound text, a path outside the recorded-words channels, an attribution missing, naming
 * the wrong author or the wrong time — each checked against the channel table above, never the screen's own.
 */
export function quoteDefects(container, docs = {}) {
  const bad = [];
  for (const q of container.querySelectorAll('[data-quote-path]')) {
    const where = q.getAttribute('data-quote-path');
    if (!boundTextOf(q, docs)) bad.push(`${where}: not bound — its text is not the stored value`);
  }
  for (const root of container.querySelectorAll('[data-quotation]')) {
    const texts = [...root.children].filter((c) => c.hasAttribute('data-quote-path'));
    if (texts.length !== 1) { bad.push(`a quotation with ${texts.length} quoted texts`); continue; }
    const where = texts[0].getAttribute('data-quote-path');
    // Astra B1: a quotation never sits inside a heading — the heading is the screen's voice
    if (root.closest(HEADINGS)) { bad.push(`${where}: inside a heading`); continue; }
    const channel = SPEC_QUOTE_CHANNELS.find((c) => c.re.test(where));
    if (!channel) { bad.push(`${where}: not a recorded-words channel`); continue; }
    const attr = [...root.children].find((c) => c.hasAttribute('data-quote-attribution'));
    if (!attr) { bad.push(`${where}: no attribution`); continue; }
    const doc = docs[texts[0].getAttribute('data-quote-doc') || 'tape'];
    const clock = doc ? recordTime(valueAt(doc, channel.at(parsePath(where))), doc.etDate) : null;
    const want = `— ${channel.by} · ${clock ?? 'not recorded'}`;
    if (attr.textContent !== want) bad.push(`${where}: attributed “${attr.textContent}”, the record says “${want}”`);
    else if (clock && attr.querySelector('[data-time]')?.textContent !== clock) bad.push(`${where}: its time is not marked as an instant`);
  }
  return bad;
}

/**
 * Every text node and every aria-label / title, each its own span of text: an element's edge is a word boundary
 * (review A2L4-1). No exemption for a company's name: the forbidden list stands as written (R5; review A2P1-2).
 * R7: the words of a BOUND quotation are the record's, not the screen's voice, so they are left out — and nothing
 * else is: an attribute is always the screen's.
 */
export function renderedText(container, docs = {}) {
  const parts = [];
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if (!boundQuotationOf(node, docs) && !boundAgentNameOf(node, docs)) parts.push(node.textContent);
  for (const el of container.querySelectorAll(TEXT_ATTRIBUTE_SELECTOR)) for (const attr of TEXT_ATTRIBUTES) parts.push(el.getAttribute(attr) || '');
  return parts.join(' \n ');
}

/**
 * R8 — every cardinal word in the screen's own voice that is not a marked number: a text node outside a bound
 * quotation (R7), outside a marked number's own text, outside the directory's own name for a symbol (R4(d), as the
 * digit sweep), and outside a stored note BOUND to an R1 / R9 path (R1, R9: stored notes render verbatim, as the
 * tape's own words; ruled for words as for digits; Astra B2: by binding, never by a string match); and every
 * text-bearing attribute.
 */
function numberWordHits(container, docs) {
  const hits = [];
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent;
    if (!NUMBER_WORD.test(text)) continue;
    const host = node.parentElement;
    if (boundQuotationOf(node, docs)) continue;
    if (markedNumberText(host)) continue;
    if (isDirectoryName(host)) continue;
    if (boundStoredNoteOf(node, docs)) continue;
    if (boundAgentNameOf(node, docs)) continue;   // R13
    const m = text.match(NUMBER_WORD);
    if (m) hits.push(`number word “${m[0]}”: ${node.textContent.trim().slice(0, 80)}`);
  }
  for (const el of container.querySelectorAll(TEXT_ATTRIBUTE_SELECTOR)) {
    for (const attr of TEXT_ATTRIBUTES) {
      const m = (el.getAttribute(attr) || '').match(NUMBER_WORD);
      if (m) hits.push(`number word “${m[0]}” in ${attr}: ${el.getAttribute(attr).slice(0, 80)}`);
    }
  }
  return hits;
}

/**
 * The screen's own voice (R7: everything outside a bound quotation): no verdict, ranking or forbidden word (or its
 * inflection), no "Why" heading, and no number spelled as a word outside a marked number (R8). `docs` names the
 * documents a quotation may be bound to (as sweepNumbers).
 */
export function sweepWords(container, docs = {}) {
  const text = renderedText(container, docs).toLowerCase();
  const hits = SPEC_FORBIDDEN_WORDS.filter((w) => new RegExp(`\\b${w.replace(/ /g, '\\s+')}(s|es|d|ed|ing)?\\b`).test(text));
  if (/\bwhy\s*\?/i.test(text)) hits.push('Why?');
  for (const h of container.querySelectorAll('h1, h2, h3, h4, h5, h6')) if (/^\s*why\b/i.test(h.textContent)) hits.push(`heading: ${h.textContent.trim()}`);
  hits.push(...numberWordHits(container, docs));
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
