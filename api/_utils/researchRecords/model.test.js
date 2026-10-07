// api/_utils/researchRecords/model.test.js
//
// Pilot P2 — the research record's pure model (api/_utils/researchRecords/model.js).
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file imports model.js, which
// imports src/constants/researchRecords.js; the import IS the guard that the
// src/ module stays Node-clean. Never mock it.

import { describe, it, expect } from 'vitest';
import {
  RESEARCH_STAGES, STAGES_BY_ORIGIN, RESEARCH_ORIGINS, SYMBOLS_MAX, SCREENS_MAX, TOKENS_UNKNOWN,
  researchWorkIdFor, isResearchWorkId, researchRefOf, stagesFor, capSymbols, uniqueSymbols, normalizeSymbol,
  dialogueFunnel, screenEntryOf, savedScreenOf, screenerFunnel, analysisFunnel, manualFunnel,
  budgetOf, emptyTelemetry, usageOf, applyTurn, buildRecord, subjectPatch, turnPatch, closePatch, recordSummaryOf,
  isOwnedRecord, currentVersionOfList, dialogueOriginOf,
} from './model.js';

const NOW = '2026-10-07T14:00:00.000Z';
const LATER = '2026-10-07T15:00:00.000Z';

describe('identity — the id is derived from the host (one record per host document)', () => {
  it('each host collection has its own prefix; the same host always gives the same id', () => {
    expect(researchWorkIdFor({ collection: 'researchSessions', id: 'abc' })).toBe('rs_abc');
    expect(researchWorkIdFor({ collection: 'watchlistSessions', id: 'abc' })).toBe('ws_abc');
    expect(researchWorkIdFor({ collection: 'analysisSessions', id: 'abc' })).toBe('as_abc');
    expect(researchWorkIdFor({ collection: 'watchlists', id: 'abc' })).toBe('wl_abc');
    expect(researchWorkIdFor({ collection: 'researchSessions', id: 'abc' })).toBe(researchWorkIdFor({ collection: 'researchSessions', id: 'abc' }));
  });
  it('an unknown collection or a malformed host id throws (never a guessed id)', () => {
    expect(() => researchWorkIdFor({ collection: 'agents', id: 'abc' })).toThrow();
    for (const id of ['', 'a/b', 'x'.repeat(129), null, 7]) expect(() => researchWorkIdFor({ collection: 'researchSessions', id })).toThrow();
  });
  it('isResearchWorkId accepts exactly the minted shapes; researchRefOf builds the typed evidence ref', () => {
    for (const ok of ['rs_a', 'ws_A-1_b', 'as_x', 'wl_y']) expect(isResearchWorkId(ok)).toBe(true);
    for (const bad of ['rs_', 'xx_a', 'rs_a/b', 'rs a', null, undefined, 12]) expect(isResearchWorkId(bad)).toBe(false);
    expect(researchRefOf('rs_a')).toEqual({ kind: 'researchWork', id: 'rs_a' });
    expect(() => researchRefOf('nope')).toThrow();
  });
  it('the theme discriminant lives only on the session', () => {
    expect(dialogueOriginOf({ source: 'theme' })).toBe('theme');
    expect(dialogueOriginOf({})).toBe('signaldrop');
    expect(dialogueOriginOf(null)).toBe('signaldrop');
  });
});

describe('stages — a stage the host does not have is null, NEVER 0', () => {
  it('the per-origin table, as built', () => {
    expect(STAGES_BY_ORIGIN).toEqual({
      signaldrop: ['shortlisted', 'selectedForInvestigation', 'eligible'],
      theme: ['shortlisted', 'selectedForInvestigation', 'eligible'],
      screener: ['universeSize', 'matchedPreLimit', 'shortlisted', 'eligible'],
      analysis: ['selectedForInvestigation', 'investigationsCompleted'],
      manual: [],
    });
    expect(Object.keys(STAGES_BY_ORIGIN).sort()).toEqual([...RESEARCH_ORIGINS].sort());
  });
  it('stagesFor: present → its count (0 allowed), absent → null even when a value is offered; a missing count throws', () => {
    const all = Object.fromEntries(RESEARCH_STAGES.map((k) => [k, 0]));
    for (const origin of RESEARCH_ORIGINS) {
      const s = stagesFor(origin, all);
      for (const k of RESEARCH_STAGES) expect(s[k]).toBe(STAGES_BY_ORIGIN[origin].includes(k) ? 0 : null);
    }
    expect(() => stagesFor('screener', { universeSize: 6, matchedPreLimit: 4, shortlisted: 3 })).toThrow(/eligible/);
    expect(() => stagesFor('screener', { universeSize: -1, matchedPreLimit: 0, shortlisted: 0, eligible: 0 })).toThrow();
    expect(() => stagesFor('martian', {})).toThrow();
  });
});

describe('symbols', () => {
  it('normalised once: trimmed, upper-cased, first-seen order, each symbol once', () => {
    expect(normalizeSymbol(' nvda ')).toBe('NVDA');
    expect(normalizeSymbol('')).toBeNull();
    expect(uniqueSymbols(['nvda', 'NVDA', ' amd', null, '', 'AMD', 'avgo'])).toEqual(['NVDA', 'AMD', 'AVGO']);
  });
  it('capped at SYMBOLS_MAX with symbolsTruncated', () => {
    const many = Array.from({ length: SYMBOLS_MAX + 5 }, (_, i) => ({ symbol: `S${i}`, outcome: null, reason: null }));
    expect(capSymbols(many)).toEqual({ symbols: many.slice(0, SYMBOLS_MAX), symbolsTruncated: true });
    expect(capSymbols(many.slice(0, 3))).toEqual({ symbols: many.slice(0, 3), symbolsTruncated: false });
  });
  it('stage counts come from the FULL cohort even when the stored list is truncated', () => {
    const candidates = Array.from({ length: SYMBOLS_MAX + 20 }, (_, i) => ({ symbol: `S${i}`, status: i % 2 ? 'removed' : 'kept' }));
    const f = dialogueFunnel({ candidates });
    expect(f.stages).toEqual({ shortlisted: SYMBOLS_MAX + 20, selectedForInvestigation: (SYMBOLS_MAX + 20) / 2, eligible: 0 });
    const r = buildRecord({ researchWorkId: 'ws_s', userId: 'u', origin: 'signaldrop', host: { collection: 'watchlistSessions', id: 's' }, createdAt: NOW, funnel: f, telemetry: emptyTelemetry() });
    expect(r.symbols).toHaveLength(SYMBOLS_MAX);
    expect(r.symbolsTruncated).toBe(true);
    expect(r.stages.shortlisted).toBe(SYMBOLS_MAX + 20);
  });
});

describe('the dialogue funnel', () => {
  const candidates = [
    { symbol: 'NVDA', status: 'kept' }, { symbol: 'amd', status: 'proposed' }, { symbol: 'INTC', status: 'removed' },
    { symbol: 'NVDA', status: 'removed' }, // a duplicate never counts twice (first entry wins, as the host dedupes)
    { symbol: '', status: 'kept' }, { status: 'kept' },
  ];
  it('open: proposed · not removed · 0 saved; removed is rejected / removed (no actor invented); the rest undecided', () => {
    const f = dialogueFunnel({ candidates });
    expect(f.stages).toEqual({ shortlisted: 3, selectedForInvestigation: 2, eligible: 0 });
    expect(f.symbols).toEqual([
      { symbol: 'NVDA', outcome: null, reason: null },
      { symbol: 'AMD', outcome: null, reason: null },
      { symbol: 'INTC', outcome: 'rejected', reason: 'removed' },
    ]);
  });
  it('saved: eligible = what the save carried; a kept candidate the save did not carry is rejected / not_saved', () => {
    const f = dialogueFunnel({ candidates, saved: ['NVDA'] });
    expect(f.stages).toEqual({ shortlisted: 3, selectedForInvestigation: 2, eligible: 1 });
    expect(f.symbols.map((s) => `${s.symbol}:${s.outcome}:${s.reason}`)).toEqual(['NVDA:eligible:saved_to_list', 'AMD:rejected:not_saved', 'INTC:rejected:removed']);
  });
  it('abandoned: every open candidate cancelled with the terminal reason; outcomes disjoint and cover the cohort', () => {
    const f = dialogueFunnel({ candidates, terminalReason: 'user_close' });
    expect(f.symbols.map((s) => `${s.symbol}:${s.outcome}:${s.reason}`)).toEqual(['NVDA:cancelled:user_close', 'AMD:cancelled:user_close', 'INTC:rejected:removed']);
  });
  it('no candidates at all is a valid funnel of zeros (stages that exist), never nulls', () => {
    expect(dialogueFunnel({ candidates: [], saved: [] })).toEqual({ stages: { shortlisted: 0, selectedForInvestigation: 0, eligible: 0 }, symbols: [] });
  });
});

describe('the screener funnel', () => {
  const screen = (symbols, universeSize = 6, matchCount = symbols.length + 1, resultType = 'stocks') => screenEntryOf({
    atIso: NOW, resultType, universeSize, matchCount, results: symbols.map((symbol) => ({ symbol })),
  });
  it('screenEntryOf: the screen\'s own values; an industry roll-up records no symbols', () => {
    expect(screen(['NVDA', 'nvda', 'AMD'])).toEqual({ at: NOW, resultType: 'stocks', universeSize: 6, matchedPreLimit: 4, returned: 2, symbols: ['NVDA', 'AMD'] });
    expect(screenEntryOf({ atIso: NOW, resultType: 'industries', universeSize: 40, matchCount: 40, results: [{ industryName: 'Semis' }, { industryName: 'Banks' }] }))
      .toEqual({ at: NOW, resultType: 'industries', universeSize: 40, matchedPreLimit: 40, returned: 2, symbols: [] });
  });
  it('open → the latest STOCK screen; before any, the screener stages are 0 (nothing screened yet)', () => {
    expect(screenerFunnel({ screens: [] }).stages).toEqual({ universeSize: 0, matchedPreLimit: 0, shortlisted: 0, eligible: 0 });
    const a = screen(['NVDA', 'AMD', 'AVGO'], 6, 4);
    const ind = screen([], 40, 40, 'industries');
    const f = screenerFunnel({ screens: [a, ind] });
    expect(f.stages).toEqual({ universeSize: 6, matchedPreLimit: 4, shortlisted: 3, eligible: 0 });
    expect(f.symbols.every((s) => s.outcome === null)).toBe(true);
  });
  it('saved → the latest screen that returned EVERY saved symbol, not merely the latest', () => {
    const a = screen(['NVDA', 'AMD', 'AVGO'], 6, 4);
    const b = screen(['INTC', 'QCOM'], 6, 2);
    expect(savedScreenOf([a, b], ['NVDA', 'AMD'])).toBe(a);
    const f = screenerFunnel({ screens: [a, b], saved: ['nvda', 'AMD'] });
    expect(f.stages).toEqual({ universeSize: 6, matchedPreLimit: 4, shortlisted: 3, eligible: 2 });
    expect(f.symbols.map((s) => `${s.symbol}:${s.outcome}:${s.reason}`)).toEqual(['NVDA:eligible:saved_to_list', 'AMD:eligible:saved_to_list', 'AVGO:rejected:not_saved']);
  });
  it('a saved symbol no recorded screen returned joins flagged addedAtSave (eligible without the screening stages)', () => {
    const a = screen(['NVDA', 'AMD'], 6, 2);
    const f = screenerFunnel({ screens: [a], saved: ['NVDA', 'TSLA'] });
    expect(f.stages).toEqual({ universeSize: 6, matchedPreLimit: 2, shortlisted: 2, eligible: 2 });
    expect(f.symbols).toEqual([
      { symbol: 'NVDA', outcome: 'eligible', reason: 'saved_to_list' },
      { symbol: 'AMD', outcome: 'rejected', reason: 'not_saved' },
      { symbol: 'TSLA', outcome: 'eligible', reason: 'saved_to_list', addedAtSave: true },
    ]);
    // With no overlapping screen at all, no screen is claimed: 0 screened, every saved symbol an addition.
    expect(screenerFunnel({ screens: [screen(['INTC'])], saved: ['TSLA'] }).stages).toEqual({ universeSize: 0, matchedPreLimit: 0, shortlisted: 0, eligible: 1 });
  });
});

describe('the analysis and manual funnels', () => {
  it('analysis: selected = the cohort, investigated = covered; off-universe is data_missing / off_universe, flagged; nothing else decided', () => {
    const f = analysisFunnel({ symbols: ['NVDA', 'AMD', 'ZZZZ'], digest: { size: 3, covered: 2, offUniverse: ['ZZZZ'] } });
    expect(f).toEqual({
      stages: { selectedForInvestigation: 3, investigationsCompleted: 2 },
      symbols: [
        { symbol: 'NVDA', outcome: null, reason: null },
        { symbol: 'AMD', outcome: null, reason: null },
        { symbol: 'ZZZZ', outcome: 'data_missing', reason: 'off_universe', offUniverse: true },
      ],
    });
  });
  it('manual: no stage, no cohort', () => {
    expect(manualFunnel()).toEqual({ stages: {}, symbols: [] });
    expect(stagesFor('manual', manualFunnel().stages)).toEqual(Object.fromEntries(RESEARCH_STAGES.map((k) => [k, null])));
  });
});

describe('budget and telemetry', () => {
  it('the budget is named in its currency; malformed counts throw', () => {
    expect(budgetOf({ messageBudget: 30, messagesUsed: 2 })).toEqual({ currency: 'persisted_messages', allotted: 30, used: 2 });
    expect(() => budgetOf({ messageBudget: 30 })).toThrow();
  });
  it('a fresh block: zero calls → zero tokens, exactly; the screener keeps screens[]', () => {
    expect(emptyTelemetry()).toEqual({ attempts: 0, completions: 0, failures: 0, cancellations: 0, elapsedMs: 0, firstTurnAt: null, lastTurnAt: null, tokens: { input: 0, output: 0 } });
    expect(emptyTelemetry({ screens: true }).screens).toEqual([]);
  });
  it('usageOf: only non-negative integer counts from the provider', () => {
    expect(usageOf({ input: 3, output: 4 })).toEqual({ input: 3, output: 4 });
    for (const bad of [null, {}, { input: 3 }, { input: -1, output: 2 }, { input: 1.5, output: 2 }, { input: '3', output: 4 }]) expect(usageOf(bad)).toBeNull();
  });
  it('applyTurn: every kind counts an attempt; elapsed sums the measured time; first/last turn times', () => {
    let t = emptyTelemetry();
    t = applyTurn(t, { kind: 'completion', elapsedMs: 1200.4, usage: { input: 10, output: 2 }, atIso: NOW });
    t = applyTurn(t, { kind: 'cancellation', elapsedMs: 300, usage: { input: 5, output: 1 }, atIso: LATER });
    expect(t).toEqual({ attempts: 2, completions: 1, failures: 0, cancellations: 1, elapsedMs: 1500, firstTurnAt: NOW, lastTurnAt: LATER, tokens: { input: 15, output: 3 } });
    t = applyTurn(t, { kind: 'failure', elapsedMs: -5, atIso: LATER });
    expect(t).toMatchObject({ attempts: 3, failures: 1, elapsedMs: 1500, tokens: TOKENS_UNKNOWN });
    t = applyTurn(t, { kind: 'completion', elapsedMs: NaN, usage: { input: 1, output: 1 }, atIso: LATER });
    expect(t.tokens).toBe(TOKENS_UNKNOWN); // unknown is for good — never a partial sum
    expect(() => applyTurn(t, { kind: 'retry', atIso: NOW })).toThrow();
    expect(() => applyTurn(t, { kind: 'failure' })).toThrow();
  });
  it('applyTurn keeps at most SCREENS_MAX screens (the latest)', () => {
    let t = emptyTelemetry({ screens: true });
    for (let i = 0; i < SCREENS_MAX + 3; i++) t = applyTurn(t, { kind: 'completion', atIso: NOW, screen: { at: `${i}`, resultType: 'stocks', symbols: [] } });
    expect(t.screens).toHaveLength(SCREENS_MAX);
    expect(t.screens[0].at).toBe('3');
  });
});

describe('the record and its patches', () => {
  const base = () => buildRecord({
    researchWorkId: 'ws_s', userId: 'u', origin: 'signaldrop', host: { collection: 'watchlistSessions', id: 's' }, createdAt: NOW,
    funnel: dialogueFunnel({ candidates: [{ symbol: 'NVDA', status: 'kept' }] }), budget: budgetOf({ messageBudget: 20, messagesUsed: 1 }), telemetry: emptyTelemetry(),
  });
  it('buildRecord: identity, subject, funnel, budget, telemetry, terminal — and refuses what is malformed', () => {
    expect(base()).toEqual({
      schemaVersion: 1, researchWorkId: 'ws_s', userId: 'u', origin: 'signaldrop', host: { collection: 'watchlistSessions', id: 's' }, createdAt: NOW,
      watchlistId: null, hypothesisVersion: null,
      stages: { universeSize: null, matchedPreLimit: null, shortlisted: 1, selectedForInvestigation: 1, investigationsCompleted: null, eligible: 0 },
      symbols: [{ symbol: 'NVDA', outcome: null, reason: null }], symbolsTruncated: false,
      budget: { currency: 'persisted_messages', allotted: 20, used: 1 }, telemetry: emptyTelemetry(),
      state: 'open', terminalReason: null, endedAt: null, updatedAt: NOW,
    });
    const ok = { researchWorkId: 'wl_l', userId: 'u', origin: 'manual', host: null, createdAt: NOW, funnel: manualFunnel(), telemetry: emptyTelemetry() };
    expect(() => buildRecord(ok)).not.toThrow();
    expect(() => buildRecord({ ...ok, host: { collection: 'x', id: 'y' } })).toThrow(); // manual has no host
    expect(() => buildRecord({ ...ok, origin: 'screener' })).toThrow(); // a session origin needs its host
    expect(() => buildRecord({ ...ok, researchWorkId: 'bad' })).toThrow();
    expect(() => buildRecord({ ...ok, state: 'done' })).toThrow();
    expect(() => buildRecord({ ...ok, hypothesisVersion: 0 })).toThrow();
  });
  it('subjectPatch: set ONCE — a record that already names a list keeps it', () => {
    expect(subjectPatch(base(), { watchlistId: 'wl-1', hypothesisVersion: 1 })).toEqual({ watchlistId: 'wl-1', hypothesisVersion: 1 });
    expect(subjectPatch(base(), { watchlistId: 'wl-1', hypothesisVersion: 0 })).toEqual({ watchlistId: 'wl-1', hypothesisVersion: null });
    expect(subjectPatch({ ...base(), watchlistId: 'wl-0' }, { watchlistId: 'wl-1', hypothesisVersion: 2 })).toEqual({});
  });
  it('turnPatch: telemetry always; the funnel only while open', () => {
    const f = dialogueFunnel({ candidates: [{ symbol: 'NVDA', status: 'kept' }, { symbol: 'AMD', status: 'kept' }] });
    const open = turnPatch(base(), { kind: 'completion', elapsedMs: 5, atIso: LATER, funnel: f, budget: budgetOf({ messageBudget: 20, messagesUsed: 2 }) });
    expect(open).toMatchObject({ updatedAt: LATER, budget: { used: 2 }, stages: { shortlisted: 2 } });
    const closed = turnPatch({ ...base(), state: 'completed' }, { kind: 'completion', elapsedMs: 5, atIso: LATER, funnel: f });
    expect('stages' in closed).toBe(false);
    expect(closed.telemetry.attempts).toBe(1);
    // A funnel may be a function of the turn's new telemetry.
    const viaFn = turnPatch(base(), { kind: 'completion', atIso: LATER, funnel: (t) => { expect(t.attempts).toBe(1); return f; } });
    expect(viaFn.stages.shortlisted).toBe(2);
  });
  it('closePatch: an open record closes once (with its final funnel and subject); a terminal one never moves', () => {
    const p = closePatch(base(), {
      state: 'completed', terminalReason: 'saved_to_list', atIso: LATER,
      funnel: dialogueFunnel({ candidates: [{ symbol: 'NVDA', status: 'kept' }], saved: ['NVDA'] }), subject: { watchlistId: 'wl-1', hypothesisVersion: 1 },
    });
    expect(p).toMatchObject({ state: 'completed', terminalReason: 'saved_to_list', endedAt: LATER, watchlistId: 'wl-1', hypothesisVersion: 1, stages: { eligible: 1 } });
    for (const s of ['completed', 'abandoned', 'failed']) expect(closePatch({ ...base(), state: s }, { state: 'abandoned', terminalReason: 'user_close', atIso: LATER, funnel: manualFunnel() })).toBeNull();
    expect(() => closePatch(base(), { state: 'open', terminalReason: 'x', atIso: LATER, funnel: manualFunnel() })).toThrow();
  });
  it('the Forge summary carries counts and state — never the cohort, the budget or telemetry', () => {
    expect(recordSummaryOf(base())).toEqual({
      researchWorkId: 'ws_s', origin: 'signaldrop', createdAt: NOW, watchlistId: null, hypothesisVersion: null,
      stages: { universeSize: null, matchedPreLimit: null, shortlisted: 1, selectedForInvestigation: 1, investigationsCompleted: null, eligible: 0 },
      state: 'open', terminalReason: null, endedAt: null,
    });
  });
  it('isOwnedRecord and currentVersionOfList never throw', () => {
    expect(isOwnedRecord(base(), 'u')).toBe(true);
    expect(isOwnedRecord(base(), 'v')).toBe(false);
    expect(isOwnedRecord({ ...base(), state: 'weird' }, 'u')).toBe(false);
    expect(isOwnedRecord(null, 'u')).toBe(false);
    expect(currentVersionOfList({ currentHypothesisVersion: 3 })).toBe(3);
    for (const w of [{}, { currentHypothesisVersion: 0 }, { currentHypothesisVersion: '2' }, null]) expect(currentVersionOfList(w)).toBeNull();
  });
});

describe('table E — no forbidden vocabulary in the record modules', () => {
  const FORBIDDEN = [
    /\bhedge/i, /\btrim/i, /\bpartial/i, /\bscale (in|out)\b/i, /take some off/i, /cash position/i, /move to cash/i,
    /sit in cash/i, /wait for the market to/i, /probably|likely fine/i, /guaranteed/i, /can'?t lose/i,
  ];
  it('every quoted literal in model.js, store.js and src/constants/researchRecords.js', async () => {
    const { readFileSync } = await import('node:fs');
    const literals = ['./model.js', './store.js', '../../../src/constants/researchRecords.js']
      .map((f) => readFileSync(new URL(f, import.meta.url), 'utf8'))
      .flatMap((src) => [...src.matchAll(/'([^'\n]*)'/g), ...src.matchAll(/`([^`]*)`/g)].map((m) => m[1]));
    expect(literals.length).toBeGreaterThan(30);
    expect(literals.flatMap((s) => FORBIDDEN.filter((re) => re.test(s)).map((re) => `${re} in "${s}"`))).toEqual([]);
  });
});
