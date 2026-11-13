// Research Modal Build C — HONESTY (spec §4.4, BC-5, BC-14). Every new string
// and template, every rendered pack (six archetypes, three questions), and the
// RESEARCH ASK prompt block are scanned for the forbidden terms: the build's own
// ("the agent held off", "will bank", "stop at $X", "what it read"), Build A's,
// the Desk guard's agent verbs (deskHonesty.test.js), and the prompt registry's
// FORBIDDEN_SIGNALS (the prompt honesty sweep's list, applied to the new block).

import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'acorn';
import acornJsx from 'acorn-jsx';
import { SHEET_COPY, SHELL_COPY, QUESTION_TEXT, FACTOR_WORDS, RISK_WORDS, RISK_REASON_WORDS, REGIME_WORDS } from './sheetCopy.js';
import { buildPacks, stanceOf, QUESTION_IDS } from './packs.js';
import { latestLineOf } from './latestLine.js';
import AnalysisSheet, { SheetActionRow } from './AnalysisSheet.jsx';
import { measuredSheetBattle, SHEET_NOW, ARCHETYPES, AAPL_DAILY, RANKINGS } from './__fixtures__/sheetBattles.js';
import { renderResearchAskBlock, RESEARCH_ASK_QUESTION_GUIDE } from '../../../../api/_utils/voiceLayerPrompt.js';
import { FORBIDDEN_SIGNALS } from '../../../../api/_utils/__fixtures__/promptHonestyRegistry.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESK_FORBIDDEN = ['watching', 'thinking', 'researching', 'analyzing', 'about to', 'close to trading', 'wants to', 'looking at', 'eyeing', 'considering'];
const BUILD_A_FORBIDDEN = ['the agent held', 'will bank', 'guaranteed', 'will score', 'is going to'];
const SHEET_FORBIDDEN = ['the agent held off', 'will bank', 'what it read', 'will rotate', 'will swap'];
const ALL = [...DESK_FORBIDDEN, ...BUILD_A_FORBIDDEN, ...SHEET_FORBIDDEN];
const hit = (s, term) => new RegExp(`\\b${term.replace(/ /g, '\\s+')}\\b`, 'i').test(s);
// "stop at $X", in any spelling: a stop or a target beside a price.
const STOP_PRICE = /\b(stop|target|stop-loss|stoploss)\b[^.]{0,20}\$\s?\d/i;

const ARG = { arch: 'Trend Follower', sym: 'EOG', time: 'Fri 1:15', when: 'Tue 10/13', date: 'Tue 10/13', price: 154.76, d: 2, movePct: 4.3, points: 15, q: 'Does this protect the lead?', left: 7, question: 'Does this protect the lead?', text: 'Hold EOG.', label: 'next check 1:15', words: 'hold', preset: 'Aggressive', bust: '0.9', ticks: 3, trail: '1.5', next: 'next check 1:15', offPct: 1.2, high: 161.55, n: 6, rows: ['EOG 78'], gap: 1.64, gapPct: 1.0, asOf: 'Thu 10/15', score: 78.4, summary: 'Volume 2× on a break.', statement: 'An idea.', you: '62', them: '68', parts: ['an uptrend'], chg: 2.6, atrX: 1.05, entry: 154.76, f1: 'technicalScore', w1: 0.4, f2: 'baggerBombFit', w2: 0.3, side: 'above', huddle: true, names: ['XOM (6)'], band: '0.5', since: 'Tue 10/13', live: 162.1, word: 'next rung',
  // QF-2 – QF-4 (Nov 13): the book, the bench alternative, the lock, the downside.
  rungs: '−0.4', rank: 2, lowSym: 'EQIX', lowRungs: '−0.4', others: ['ETH'], atr: '2.8%', total: 68, gain: 53, banked: 15, hit: -10, entryGap: 2.45, entryPct: 2.37,
  down: { label: 'Bust', points: -10, price: 98.73, gap: 4.47, pct: 4.33 } };
// Each QF-2 – QF-4 argument's other branch (the weakest itself, the only stock, nothing off the ladder, below entry,
// at the downside rung, no downside rung, nothing hit, no ATR reading).
const VARIANTS = { rank: [1], n: [1], others: [[]], entryGap: [-0.5, 0], down: [null, { label: 'Bust', points: -10, price: 98.73, gap: 0, pct: 0 }], hit: [0], atr: [null] };
const paramsOf = (fn) => fn.toString().slice(fn.toString().indexOf('(') + 1, fn.toString().indexOf(')')).split(',').map((p) => p.trim()).filter(Boolean);
// The two-view shell's templates (SHELL_COPY, SB-13): their own arguments. The agent's name is
// always handed in — a sample one here, never a literal in the copy.
const SHELL_ARG = { agent: 'Juno', arch: 'Trend Follower', time: 'Fri 1:15', rating: 'Buy', n: 24, name: 'EOG Resources', change: '+2.2%', who: 'Juno', group: 'Utilities', kind: 'technical', day: 'Wed Nov 11', v: 2.28 };
function templates() {
  const out = [];
  for (const [k, v] of Object.entries(SHEET_COPY)) {
    if (typeof v === 'string') { out.push([k, v]); continue; }
    const names = paramsOf(v);
    for (const n of names) expect(ARG, `${k}(${n})`).toHaveProperty(n);
    out.push([k, v(...names.map((n) => ARG[n]))]);
    if (names.includes('points')) out.push([k, v(...names.map((n) => (n === 'points' ? 0 : ARG[n])))]);
    if (names.includes('names')) out.push([k, v(...names.map((n) => (n === 'names' ? [] : ARG[n])))]);
    if (names.includes('f2')) out.push([k, v(...names.map((n) => (n === 'f2' || n === 'w2' ? null : ARG[n])))]);
    for (const [key, vals] of Object.entries(VARIANTS)) if (names.includes(key)) for (const val of vals) out.push([k, v(...names.map((n) => (n === key ? val : ARG[n])))]);
  }
  for (const [k, v] of Object.entries(SHELL_COPY)) {
    if (typeof v === 'string') { out.push([`shell.${k}`, v]); continue; }
    const names = paramsOf(v);
    for (const n of names) expect(SHELL_ARG, `shell.${k}(${n})`).toHaveProperty(n);
    out.push([`shell.${k}`, v(...names.map((n) => SHELL_ARG[n]))]);
    // Each optional argument absent (no agent, no time, no day, browse's no one, n = 1).
    for (const gone of ['agent', 'time', 'day', 'who', 'change']) if (names.includes(gone)) out.push([`shell.${k}`, v(...names.map((n) => (n === gone ? null : SHELL_ARG[n])))]);
    if (names.includes('n')) out.push([`shell.${k}`, v(...names.map((n) => (n === 'n' ? 1 : SHELL_ARG[n])))]);
  }
  for (const table of [QUESTION_TEXT, FACTOR_WORDS, RISK_WORDS, RISK_REASON_WORDS, REGIME_WORDS]) for (const [k, v] of Object.entries(table)) out.push([k, v]);
  return out;
}

const BATTLES = {};
beforeAll(async () => { for (const a of ARCHETYPES) BATTLES[a] = await measuredSheetBattle({ archetype: a }); });
const args = (battle) => ({ battle, symbol: 'AAPL', nowMs: SHEET_NOW, row: { positionId: 'position-agent' }, live: 103.2, dailyBars: AAPL_DAILY, rankings: RANKINGS, standing: { player: 62, opponent: 68 }, directive: battle.directive, incumbent: 'ETH', battleId: 'stock-battle' });
const viewOf = (battle, question) => {
  const built = buildPacks(args(battle));
  const stance = stanceOf(args(battle));
  return {
    symbol: 'AAPL', archetype: built.lens.label, agentName: 'Juno', stance, latest: latestLineOf({ battle, symbol: 'AAPL', held: true }), latestWho: 'Trend Follower · Wed 12:45', latestTime: 'Wed 12:45',
    order: ['catch_up', 'protect_lead', 'better_than_stalled'], question, pack: question ? built.packs[question] : null, activeItem: null,
    budget: { left: 7, limit: 10 }, canAsk: !!question, answering: false, reply: { status: 'idle' }, filed: false, cockpit: () => {},
    ask() {}, pickQuestion() {}, backToQuestions() {}, tapItem() {},
  };
};
const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('every template of the copy module', () => {
  it.each(ALL)('never says "%s"', (term) => {
    for (const [k, s] of templates()) expect(hit(s, term), `${k}: ${s}`).toBe(false);
  });
  it('never puts a stop or a target beside a price (BC-5)', () => {
    for (const [k, s] of templates()) expect(STOP_PRICE.test(s), `${k}: ${s}`).toBe(false);
  });
  it('the string literals of the copy source (comments excluded) never say a forbidden term', () => {
    const src = readFileSync(path.join(HERE, 'sheetCopy.js'), 'utf8');
    const strings = [];
    const ast = Parser.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
    (function walk(n) {
      if (!n || typeof n !== 'object') return;
      if (n.type === 'Literal' && typeof n.value === 'string') strings.push(n.value);
      if (n.type === 'TemplateElement') strings.push(n.value.cooked);
      for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v);
    })(ast);
    expect(strings.length).toBeGreaterThan(50);
    for (const term of ALL) for (const s of strings) expect(hit(s, term), s).toBe(false);
  });
});

describe('the sheet components hold no words of their own — every string is the copy module\'s', () => {
  it.each(['AnalysisSheet.jsx', 'AskReply.jsx', 'ShellTabs.jsx', 'WhatsMoving.jsx'])('%s has no JSX text or string child with letters', (file) => {
    const src = readFileSync(path.join(HERE, file), 'utf8');
    const ast = Parser.extend(acornJsx()).parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
    const bad = [];
    (function walk(n) {
      if (!n || typeof n !== 'object') return;
      if (n.type === 'JSXText' && /[A-Za-z]/.test(n.value)) bad.push(n.value.trim());
      if (n.type === 'JSXExpressionContainer' && n.expression?.type === 'Literal' && typeof n.expression.value === 'string' && /[A-Za-z]/.test(n.expression.value)) bad.push(n.expression.value);
      for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v);
    })(ast);
    expect(bad).toEqual([]);
  });
});

describe('the agent\'s name is never a literal (SB-13, R-23): the shell\'s sources hold no agent name', () => {
  // A literal scan can only look for names it knows: the round-5 sample and the test fixtures' own.
  // The rendered rows (here and in the modal's) prove the label carries the view's agentName.
  it('no string literal in the sheet\'s modules or the header names a known agent ("Shadow", the round-5 sample; "Juno", the fixtures\')', () => {
    const files = [...readdirSync(HERE).filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\./.test(f)).map((f) => path.join(HERE, f)), path.join(HERE, '..', 'ChartHeader.jsx')];
    const found = [];
    for (const f of files) {
      const ast = Parser.extend(acornJsx()).parse(readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
      (function walk(n) {
        if (!n || typeof n !== 'object') return;
        const s = n.type === 'Literal' && typeof n.value === 'string' ? n.value : n.type === 'TemplateElement' ? n.value.cooked : n.type === 'JSXText' ? n.value : null;
        if (s && /\b(Shadow|Juno)\b/.test(s)) found.push(`${path.basename(f)}: ${s}`);
        for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v);
      })(ast);
    }
    expect(files.length).toBeGreaterThan(10);
    expect(found).toEqual([]);
  });
});

describe('every rendered pack — six archetypes, every question, and Layer 0', () => {
  it.each(ARCHETYPES)('%s: no forbidden term, no stop price, no RSI / RVOL / MACD claim (a held receipt never has them — Phase 0 §B)', (a) => {
    const html = [null, ...QUESTION_IDS].map((q) => renderToStaticMarkup(<><AnalysisSheet view={viewOf(BATTLES[a], q)} /><SheetActionRow view={viewOf(BATTLES[a], q)} /></>)).join('\n');
    const text = textOf(html);
    expect(text).toContain('What it decided');
    for (const term of ALL) expect(hit(text, term), term).toBe(false);
    expect(STOP_PRICE.test(text)).toBe(false);
    expect(text).not.toMatch(/\bRSI\b|\bRVOL\b|\bMACD\b/);
    // R-23 (amends R-12): the voice label names the player's OWN agent — the view's agentName
    // (Juno here) — never a hardcoded one; the round-5 sample name never reaches the modal.
    expect(text).toContain(`Juno · ${viewOf(BATTLES[a], null).archetype}`);
    expect(text).not.toMatch(/\bShadow\b/);
  });
});

describe('QF-7 — the per-question instruction', () => {
  it('the two held-stock questions carry their line; every other question renders exactly as before (no line added)', () => {
    const items = [{ kind: 'check_read', fact: 'x', status: 'verified', source: { label: 'y' }, at: null }];
    const base = (q) => renderResearchAskBlock({ symbol: 'AAPL', questionId: q, question: QUESTION_TEXT[q], items });
    for (const q of ['catch_up', 'protect_lead', 'better_than_stalled']) expect(base(q)).not.toMatch(/For this question/);
    expect(base('weakest_spot')).toContain(RESEARCH_ASK_QUESTION_GUIDE.weakest_spot);
    expect(base('take_profit')).toContain(RESEARCH_ASK_QUESTION_GUIDE.take_profit);
    for (const g of Object.values(RESEARCH_ASK_QUESTION_GUIDE)) {
      expect(g).toMatch(/no trade; the player decides/);
      for (const [name, re] of FORBIDDEN_SIGNALS) expect(re.test(g), name).toBe(false);
      for (const term of ALL) expect(hit(g, term), term).toBe(false);
    }
  });
});

describe('the prompt honesty sweep, applied to the RESEARCH ASK block', () => {
  it.each(ARCHETYPES)('%s: the rendered block trips no FORBIDDEN_SIGNAL and no forbidden term, and the pack sits inside the delimiters', (a) => {
    const { packs } = buildPacks(args(BATTLES[a]));
    for (const q of QUESTION_IDS) {
      const block = renderResearchAskBlock({ symbol: 'AAPL', questionId: q, question: QUESTION_TEXT[q], items: packs[q].items });
      for (const [name, re] of FORBIDDEN_SIGNALS) expect(re.test(block), name).toBe(false);
      for (const term of ['will bank', 'the agent held off', 'what it read']) expect(hit(block, term), term).toBe(false);
      expect(STOP_PRICE.test(block)).toBe(false);
      const open = block.indexOf('<RESEARCH_ASK_PACK>');
      const close = block.indexOf('</RESEARCH_ASK_PACK>');
      expect(open).toBeGreaterThan(0);
      for (const it of packs[q].items) { const at = block.indexOf(it.fact); expect(at > open && at < close, it.fact).toBe(true); }
    }
  });
});
