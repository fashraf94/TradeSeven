// @vitest-environment jsdom
//
// src/screens/filmRoomV2/filmRoomCopy.inventory.jsdom.test.jsx
//
// Astra B3 (confirmation §3): the quantity-word guard is a CLOSED list, so the
// screen's own copy is a CLOSED inventory — every key of every copy table the
// screen speaks from, pinned here by hand. A new key fails the key pins until
// it is added below, and every entry (each function called with sample
// arguments) goes through the screen's own-voice sweep: no forbidden word and
// no quantity word (Amendment E BA-41, R5, R8; the list in the harness).
//   FILM_ROOM_COPY        every key, recursively
//   filmRoomCopy.js       its other exports (the replay sentence, the
//                         explainer's fixture cards, the class letters and
//                         labels, the two stored-note constants)
//   filmRoomModel.js      its word tables and the words its readers compose
//                         (check states, exit makers, risk lines, the holdings
//                         notes, a symbol's role, the directive card's titles)
//   externals             the diagnostic header the screen prints in its own
//                         voice; the kit's undeclared-class label

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as copyModule from './filmRoomCopy';
import { FILM_ROOM_COPY, REPLAY_SENTENCE, DIRECTIVE_EXPLAINER, PROVENANCE_LABELS, LOCKED_BASIS_NOTE, REPLAY_VERSION_NOTE, CLASS_LETTER } from './filmRoomCopy';
import { EXIT_MAKER_WORDS, PLAN_DIRECTIONS, checkStateOf, exitMakerOf, riskLines, riskSummary, deriveHoldings, roleOf, directiveCardOf } from './filmRoomModel';
import { INTRADAY_DIAGNOSTIC_HEADER } from '../../data/intradayDiagnosticCopy';
import { KindMark } from './FilmRoomKit';
import { sweepWords, sep23Tape, clone } from './__fixtures__/filmRoomHarness';

/** Every leaf key of a copy table: `a.b`, `list[0]`, `fn()`. */
function keysOf(v, p = '', out = []) {
  if (typeof v === 'function') out.push(`${p}()`);
  else if (Array.isArray(v)) v.forEach((x, i) => keysOf(x, `${p}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) keysOf(x, p ? `${p}.${k}` : k, out);
  else out.push(p);
  return out;
}
const leaf = (obj, key) => key.replace(/\(\)$/, '').split(/\.|\[|\]/).filter(Boolean).reduce((o, k) => o?.[k], obj);

// ── the inventory, PINNED BY HAND — a new key fails until it is listed here (and swept below) ─────────────────────
const COPY_KEYS = [
  'title', 'back', 'gameName', 'battleLengthSuffix', 'battleComplete', 'battleActive',
  'depths[0].id', 'depths[0].label', 'depths[1].id', 'depths[1].label', 'depths[2].id', 'depths[2].label',
  'legend', 'dayPicker', 'firstOpenEyebrow', 'firstOpen', 'gotIt',
  'loading', 'noTape', 'noTapeScheduled()', 'noTapeLater', 'noTapeUnavailable', 'readError', 'earlierDay', 'openLastDay()', 'skippedMode', 'closeNotWritten', 'statusUnknown',
  'countOf', 'countRecorded', 'slots',
  'coverage', 'replayCoverage', 'coverageLabel.complete', 'coverageLabel.partial', 'coverageLabel.unavailable', 'preservedFrom',
  'recordedScoreAt()', 'recordedScore', 'dayChange', 'dayChangeBasis.battle_start', 'dayChangeBasis.prior_day_tape', 'dayChangeBasis.unavailable',
  'firstCheckAt()', 'noChecks', 'scorePath', 'scorePathNote', 'battleStartLine', 'checks', 'runsTitle', 'runCompleted',
  'runKinds.hold', 'runKinds.swap', 'runKinds.default_hold', 'runKinds.completed',
  'checksIn', 'swapByAgent', 'swapByRule', 'swapByOther', 'afterLastCheck', 'tapForDetail', 'finalResult', 'apartFromDay',
  'resultWord.win', 'resultWord.loss', 'resultWord.draw', 'resultBasis.stored', 'resultBasis.derived', 'resultBasis.unavailable',
  'agentVsCpu.agent', 'agentVsCpu.vs', 'agentVsCpu.cpu', 'platformAtCompletion',
  'checkAt()', 'decision', 'decisionOf()', 'decisionNone', 'defaultHoldNote', 'riskTitle', 'noRisk', 'riskNote', 'scores',
  'scoreParts.active', 'scoreParts.banked', 'scoreParts.total', 'evidenceTitle', 'evidenceLabel', 'evidenceNone',
  'evidenceFields.px', 'evidenceFields.chg', 'evidenceFields.atrX', 'evidenceFields.vwapDev', 'evidenceFields.bbPct', 'evidenceFields.nr7', 'evidenceFields.regime', 'evidenceFields.risk',
  'yes', 'no', 'notRecorded', 'close',
  'jumps[0][0]', 'jumps[0][1]', 'jumps[1][0]', 'jumps[1][1]', 'jumps[2][0]', 'jumps[2][1]', 'jumps[3][0]', 'jumps[3][1]', 'jumps[4][0]', 'jumps[4][1]', 'jumps[5][0]', 'jumps[5][1]',
  'holdings', 'holdingsStart', 'holdingsEnd', 'holdingsAt()', 'swapByMaker.agent', 'swapByMaker.platform', 'swapByMaker.other', 'swapMakerNote', 'tapForDeep',
  'swaps', 'swapsNone', 'swapWord', 'slot', 'banked', 'platformQuote', 'fork', 'holdPath', 'swapPath', 'heldLine()', 'boughtLine()', 'rebuiltDashed', 'hypothetical', 'laterTrades',
  'gap', 'gapNote', 'closedLeg', 'closedLegNote', 'replayNone', 'replayCrypto', 'split',
  'splitRows.recordedExit()', 'splitRows.barAtSwap', 'splitRows.barMinusExit', 'splitRows.rescored', 'splitRows.inputsPart', 'splitRows.pricePart', 'barClosedAt()',
  'fill', 'fillRows.recordedFill()', 'fillRows.barAtSwap', 'fillRows.barMinusFill', 'missingLabel', 'deepDoor()',
  'directives', 'directivesNone', 'directiveAt()', 'youAsked', 'directiveFiled', 'noNewDirective', 'retainedLabel', 'noneInForce', 'receipt', 'reached()', 'unconfirmed', 'reply', 'replyDiffers',
  'after', 'afterChecks()', 'afterHolds()', 'afterSwaps()', 'explainerOpen', 'explainerClose', 'explainerNote',
  'explainerLabels.committed', 'explainerLabels.no_change', 'explainerLabels.not_filed', 'readMore', 'showLess',
  'quoteBy.agent', 'quoteBy.player', 'quoteBy.platform', 'quoteBy.plan', 'quoteBy.directive',
  'plans', 'plansNone', 'plansAll', 'threshold', 'atPlan', 'atClose', 'rationale', 'rationaleNone', 'rationaleLabel()', 'stateEntry()', 'stateEntryNote', 'checksNone',
  'diagnostics', 'diagnosticsPresent',
  'deepPrice', 'deepNoSeries()', 'deepNoSymbols', 'seriesReadError', 'evidenceCoverage', 'checksIn1', 'sessionOpen', 'sessionHigh', 'sessionLow', 'lastBarClose',
  'changeOpenToClose', 'volumeSession', 'axisPrice', 'axisPercent', 'market', 'sector()', 'sectorNone', 'volume', 'rebased', 'inTheBook', 'sectorLine', 'sectorLineNone',
  'exitMark', 'entryMark', 'evidenceOverlay', 'evidenceOverlayNote', 'allSymbols', 'close10',
  'reservedHeader[0]', 'reservedHeader[1]', 'reservedFooter[0]', 'reservedFooter[1]',
];

/** Every function key's sample calls — each tuple is one call; every one is swept. */
const SAMPLE_CALLS = {
  'noTapeScheduled()': [['10:15 PM']],
  'openLastDay()': [['Sep 24']],
  'recordedScoreAt()': [['3:45 PM']],
  'firstCheckAt()': [['10:15 AM']],
  'checkAt()': [['12:45 PM']],
  'decisionOf()': [['HOLD', 'SWAP'], [null, 'HOLD'], ['HOLD', 'HOLD']],
  'holdingsAt()': [['10:15 AM', '3:45 PM']],
  'heldLine()': [['MSFT']],
  'boughtLine()': [['CRWD']],
  'splitRows.recordedExit()': [['MSFT']],
  'barClosedAt()': [['12:45 PM']],
  'fillRows.recordedFill()': [['CRWD']],
  'deepDoor()': [['PLTR']],
  'directiveAt()': [['1:40 PM'], ['Sep 22, 8:30 PM']],
  'reached()': [['1:45 PM'], ['the next check']],
  'afterChecks()': [[1], [2]],
  'afterHolds()': [[1], [2]],
  'afterSwaps()': [[1], [2]],
  'rationaleLabel()': [['12:00 PM']],
  'stateEntry()': [['12:15 PM', 'check skipped · budget']],
  'deepNoSeries()': [['INTC']],
  'sector()': [['XLK']],
};

const COPY_EXPORTS = ['CLASS_LETTER', 'DIRECTIVE_EXPLAINER', 'FILM_ROOM_COPY', 'FORBIDDEN_WORDS', 'LOCKED_BASIS_NOTE', 'PROVENANCE_LABELS', 'REPLAY_SENTENCE', 'REPLAY_VERSION_NOTE'];
const EXIT_MAKER_KEYS = ['agent.short', 'agent.swap', 'platform.short', 'platform.swap', 'gameplan.short', 'gameplan.swap', 'unrecorded.short', 'unrecorded.swap'];
const PLAN_DIRECTION_KEYS = ['potential_entry', 'potential_exit'];

// ── the model's composed words, from every branch of each reader ──────────────────────────────────────────────────
const CHECK_ROWS = [
  { state: 'completed', decision: { final: 'HOLD' } }, { state: 'completed', decision: { final: 'SWAP' } }, { state: 'completed' },
  { state: 'completed', decision: { final: 'HOLD', holdKind: 'default_failure' } },
  ...['no_trigger', 'budget_skipped', 'deferred', 'gameplan_created', 'gameplan_pending', 'proposal_pending', 'degraded_quotes', 'cpu_passive', 'tick_error', 'no_record', 'not-a-state'].map((state) => ({ state })),
];
const MECHANISMS = ['agent_decision', 'platform_risk_manager', 'archetype_rotation', 'guardrail', 'gameplan_meeting', undefined];
function modelWords() {
  const out = [];
  CHECK_ROWS.forEach((r) => out.push([`checkStateOf(${r.state}${r.decision ? ` ${r.decision.final}${r.decision.holdKind ? ' default' : ''}` : ''})`, checkStateOf(r).label]));
  for (const mechanism of MECHANISMS) for (const exitReason of ['stagnation', undefined]) out.push([`exitMakerOf(${mechanism}, ${exitReason})`, exitMakerOf({ mechanism, exitReason }).label]);
  const risky = { risk: { DE: { action: 'SWAP_OUT', reason: 'stagnation' }, MSFT: { action: 'HOLD' }, X: {} } };
  out.push(['riskSummary(none)', riskSummary({})], ['riskSummary(hold)', riskSummary({ risk: { MSFT: { action: 'HOLD' } } })], ['riskSummary(fired)', riskSummary(risky)]);
  riskLines(risky).forEach((l, i) => out.push([`riskLines[${i}]`, l.text]));
  out.push(['deriveHoldings(no risk)', deriveHoldings({ checks: [{ state: 'no_trigger' }] }).note]);
  out.push(['deriveHoldings(not reconciled)', deriveHoldings({ checks: [{ at: '2026-09-23T14:15:20.000Z', risk: { A: {} } }], actions: [{ at: '2026-09-23T15:00:00.000Z', symbolOut: 'Z', symbolIn: 'Y' }] }).note]);
  out.push(['deriveHoldings(derived)', deriveHoldings(sep23Tape).note]);
  const holdings = deriveHoldings(sep23Tape);
  const tape = clone(sep23Tape);
  tape.actions.push({ at: null, symbolOut: 'QQQ', symbolIn: 'IWM', mechanism: 'platform_risk_manager', exitReason: 'stagnation' });
  for (const sym of ['MSFT', 'CRWD', 'INTC', 'MU', 'SPY', 'QQQ', 'IWM']) out.push([`roleOf(${sym})`, roleOf(tape, sym, holdings).text]);
  out.push(['directiveCardOf(committed)', directiveCardOf({ cardState: 'committed' }).title], ['directiveCardOf(no_change)', directiveCardOf({ cardState: 'no_change' }).title]);
  return out;
}

/** The whole inventory as [key, text] — every string the screen's own voice can say from these tables. */
function inventory() {
  const out = [];
  for (const key of COPY_KEYS) {
    const v = leaf(FILM_ROOM_COPY, key);
    if (typeof v === 'function') (SAMPLE_CALLS[key] || []).forEach((args, i) => out.push([`${key}#${i}`, v(...args)]));
    else out.push([key, v]);
  }
  out.push(['REPLAY_SENTENCE', REPLAY_SENTENCE], ['LOCKED_BASIS_NOTE', LOCKED_BASIS_NOTE], ['REPLAY_VERSION_NOTE', REPLAY_VERSION_NOTE]);
  for (const k of keysOf(PROVENANCE_LABELS)) out.push([`PROVENANCE_LABELS.${k}`, leaf(PROVENANCE_LABELS, k)]);
  for (const k of keysOf(CLASS_LETTER)) out.push([`CLASS_LETTER.${k}`, leaf(CLASS_LETTER, k)]);
  for (const k of keysOf(DIRECTIVE_EXPLAINER)) { const v = leaf(DIRECTIVE_EXPLAINER, k); if (typeof v === 'string') out.push([`DIRECTIVE_EXPLAINER${k}`, v]); }
  for (const k of EXIT_MAKER_KEYS) out.push([`EXIT_MAKER_WORDS.${k}`, leaf(EXIT_MAKER_WORDS, k)]);
  for (const k of PLAN_DIRECTION_KEYS) out.push([`PLAN_DIRECTIONS.${k}`, PLAN_DIRECTIONS[k]]);
  out.push(...modelWords());
  out.push(['INTRADAY_DIAGNOSTIC_HEADER', INTRADAY_DIAGNOSTIC_HEADER]);
  out.push(['KindMark(undeclared)', new DOMParser().parseFromString(renderToStaticMarkup(<KindMark cls={null} />), 'text/html').body.firstChild.getAttribute('title')]);
  return out;
}

/** The screen's own-voice sweep over one entry, as rendered text. */
const swept = (text) => { const p = document.createElement('p'); p.textContent = text; return sweepWords(p); };

describe('Astra B3 — the copy inventory: every key of the screen\'s own copy, listed and swept', () => {
  it('FILM_ROOM_COPY holds exactly the listed keys — a new key fails here until it is added to the inventory', () => {
    expect(keysOf(FILM_ROOM_COPY)).toEqual(COPY_KEYS);
  });

  it('every function key has its sample calls, and every sample names a function key', () => {
    const fns = COPY_KEYS.filter((k) => typeof leaf(FILM_ROOM_COPY, k) === 'function');
    expect(Object.keys(SAMPLE_CALLS).sort()).toEqual([...fns].sort());
    for (const k of fns) expect(SAMPLE_CALLS[k].length, k).toBeGreaterThan(0);
  });

  it('the other copy tables hold exactly the listed keys: filmRoomCopy\'s exports, the exit makers\' words, the plan directions', () => {
    expect(Object.keys(copyModule).sort()).toEqual(COPY_EXPORTS);
    expect(keysOf(EXIT_MAKER_WORDS)).toEqual(EXIT_MAKER_KEYS);
    expect(keysOf(PLAN_DIRECTIONS)).toEqual(PLAN_DIRECTION_KEYS);
  });

  it('every entry is a non-empty string and passes the screen\'s own-voice sweep — no forbidden word, no quantity word', () => {
    const entries = inventory();
    for (const [key, text] of entries) {
      expect(typeof text === 'string' && text.length > 0, key).toBe(true);
      expect(swept(text), `${key}: “${text}”`).toEqual([]);
    }
  });

  it('the inventory\'s size is pinned (the build report states it): 231 copy keys, 318 swept entries', () => {
    expect(COPY_KEYS).toHaveLength(231);
    expect(inventory()).toHaveLength(318);
  });

  it('the inventory bites: an added key is seen, and a quantity word in an entry is caught', () => {
    expect(keysOf({ ...FILM_ROOM_COPY, sinceLastTime: 'Since last time' })).not.toEqual(COPY_KEYS);
    expect(keysOf({ ...FILM_ROOM_COPY, runKinds: { ...FILM_ROOM_COPY.runKinds, extra: 'x' } })).not.toEqual(COPY_KEYS);
    expect(swept('a hundred checks')).toEqual(['number word “hundred”: a hundred checks']);
    expect(swept('the best entry')).toEqual(['best']);
  });
});
