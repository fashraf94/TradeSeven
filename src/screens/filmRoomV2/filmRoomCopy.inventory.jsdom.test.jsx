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
import { EXIT_MAKER_WORDS, PLAN_DIRECTIONS, CHECK_STATE_WORDS, CHECK_STATE_TONES, ROLE_WORDS, HOLDINGS_NOTES, RISK_WORDS, DIRECTIVE_CARD_WORDS, checkStateOf, exitMakerOf, entryMakerOf, riskLines, riskSummary, deriveHoldings, roleOf, directiveCardOf } from './filmRoomModel';
import { INTRADAY_DIAGNOSTIC_HEADER } from '../../data/intradayDiagnosticCopy';
import { SITUATIONS, LIVE_SITUATION_IDS } from '../../data/situationRegistry';
import { SITUATION_QUESTIONS } from '../../data/situationQuestions';
import { KindMark } from './FilmRoomKit';
import { sweepWords, sep23Tape, clone, SPEC_FIXED_DIGIT_COPY } from './__fixtures__/filmRoomHarness';

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
  'title', 'backTo.battle', 'backTo.battleHistory', 'backTo.dashboard', 'backTo.unknown', 'gameName', 'battleLengthSuffix', 'battleComplete', 'battleActive',
  'depths[0].id', 'depths[0].label', 'depths[1].id', 'depths[1].label', 'depths[2].id', 'depths[2].label',
  'legend', 'dayPicker', 'firstOpenEyebrow', 'firstOpen', 'gotIt',
  'loading', 'noTape', 'noTapeScheduled.before', 'noTapeScheduled.after', 'noTapeLater', 'noTapeUnavailable', 'readError', 'earlierDay', 'openLastDay()', 'skippedMode', 'closeNotWritten', 'statusUnknown',
  'countOf', 'countRecorded', 'slots',
  'coverage', 'replayCoverage', 'coverageLabel.complete', 'coverageLabel.partial', 'coverageLabel.unavailable', 'preservedFrom',
  // B2.1 A7 — Glance's one coverage line (RJ-7)
  'coverageSummary.every', 'coverageSummary.except', 'coverageSummary.sections.checks', 'coverageSummary.sections.actions', 'coverageSummary.sections.directives',
  'coverageSummary.sections.meetings', 'coverageSummary.sections.plans', 'coverageSummary.sections.rationale', 'coverageSummary.sections.evidence', 'coverageSummary.sections.replay',
  'coverageSummary.sections.series', 'coverageSummary.notCharted()', 'coverageSummary.absent',
  'recordedScoreAt()', 'recordedScore', 'dayChange', 'dayChangeBasis.battle_start', 'dayChangeBasis.prior_day_tape', 'dayChangeBasis.unavailable',
  'firstCheckAt()', 'noChecks', 'scorePath', 'scorePathNote', 'battleStartLine', 'checks', 'runsTitle', 'runCompleted',
  'runKinds.hold', 'runKinds.swap', 'runKinds.default_hold', 'runKinds.completed',
  'checksIn', 'swapByAgent', 'swapByRule', 'swapByOther', 'afterLastCheck', 'tapForDetail', 'finalResult', 'apartFromDay',
  'resultWord.win', 'resultWord.loss', 'resultWord.draw', 'resultBasis.stored', 'resultBasis.derived', 'resultBasis.unavailable',
  'agentVsCpu.agent', 'agentVsCpu.vs', 'agentVsCpu.cpu', 'platformAtCompletion',
  'checkAt()', 'decision', 'decisionOf()', 'decisionNone', 'defaultHoldNote', 'riskTitle', 'noRisk', 'riskNote', 'scores',
  'scoreParts.active', 'scoreParts.banked', 'scoreParts.total', 'evidenceTitle', 'evidenceLabel', 'evidenceNone',
  'evidenceFields.px', 'evidenceFields.chg', 'evidenceFields.atrX', 'evidenceFields.atrXMeasured', 'evidenceFields.vwapDev', 'evidenceFields.bbPct', 'evidenceFields.nr7', 'evidenceFields.regime', 'evidenceFields.risk',
  'yes', 'no', 'notRecorded', 'close',
  'jumps[0][0]', 'jumps[0][1]', 'jumps[1][0]', 'jumps[1][1]', 'jumps[2][0]', 'jumps[2][1]', 'jumps[3][0]', 'jumps[3][1]', 'jumps[4][0]', 'jumps[4][1]', 'jumps[5][0]', 'jumps[5][1]', 'jumps[6][0]', 'jumps[6][1]',
  'holdings', 'holdingsStart', 'holdingsEnd', 'holdingsAt()', 'swapByMaker.agent', 'swapByMaker.platform', 'swapByMaker.other', 'swapMakerNote', 'tapForDeep',
  'swaps', 'swapsNone', 'swapWord', 'slot', 'banked', 'platformQuote', 'fork', 'holdPath', 'swapPath', 'heldLine()', 'boughtLine()', 'rebuiltDashed', 'rebuiltDots', 'rebuiltDashedDots', 'hypothetical', 'laterTrades',
  'gap', 'gapNote', 'closedLeg', 'closedLegNote', 'replayNone', 'replayNotDrawn', 'replayNoneSeeCoverage', 'replayCrypto', 'split',
  'splitRows.recordedExit()', 'splitRows.barAtSwap', 'splitRows.barMinusExit', 'splitRows.rescored', 'splitRows.inputsPart', 'splitRows.pricePart', 'barClosedAt()',
  'fill', 'fillRows.recordedFill()', 'fillRows.barAtSwap', 'fillRows.barMinusFill', 'missingLabel', 'deepDoor()',
  'directives', 'directivesNone', 'directiveAt()', 'youAsked', 'directiveFiled', 'noNewDirective', 'retainedLabel', 'noneInForce', 'receipt', 'reached()', 'unconfirmed', 'reply', 'replyDiffers',
  'after', 'afterChecks()', 'afterHolds()', 'afterSwaps()', 'explainerOpen', 'explainerClose', 'explainerNote',
  'explainerLabels.committed', 'explainerLabels.no_change', 'explainerLabels.not_filed', 'readMore', 'showLess',
  'quoteBy.agent', 'quoteBy.player', 'quoteBy.platform', 'quoteBy.plan', 'quoteBy.directive', 'quoteBy.you',
  'plans', 'plansNone', 'plansAll', 'threshold', 'atPlan', 'atClose', 'rationale', 'rationaleNone', 'rationaleLabel()', 'stateEntry()', 'stateEntryNote', 'checksNone',
  'diagnostics', 'diagnosticsPresent',
  // B2.1 A1 — Meetings (spec §3; acceptance H; Amendment J RJ-1)
  'meetings', 'meetingsNote', 'meetingsNone', 'meetingsNoneStored', 'meetingsAbsent', 'meetingAt()', 'meetingOutcome.approved', 'meetingOutcome.rejected', 'meetingOutcome.expired',
  'meetingResolvedBy', 'meetingInstants.created', 'meetingInstants.deadline', 'meetingInstants.resolved', 'meetingLegs', 'meetingLegNotCopied', 'meetingLegsNone', 'meetingDiagnosis', 'runMeeting',
  'deepPrice', 'noChart.before', 'noChart.reasons.crypto_not_supported', 'noChart.reasons.no_bars', 'noChartRecorded', 'recordedPrices', 'deepNoSymbols', 'seriesReadError', 'evidenceCoverage', 'checksIn1', 'sessionOpen', 'sessionHigh', 'sessionLow', 'lastBarClose',
  'changeOpenToClose', 'volumeSession', 'axisPrice', 'axisPercent', 'market', 'sector()', 'sectorNone', 'volume', 'rebased', 'inTheBook', 'companyNameNotOnFile', 'sectorLine', 'sectorLineNone',
  'exitMark', 'entryMark', 'entryFor', 'evidenceOverlay', 'evidenceOverlayNote', 'allSymbols', 'close10',
  'reservedHeader[0]', 'reservedHeader[1]', 'reservedFooter[0]', 'reservedFooter[1]',
  // Film Room B2 — the card's regions (Build B spec §6; Amendment G RG-5, RG-9)
  'cards.sinceLastTime', 'cards.preparedCase', 'cards.yourCall', 'cards.receipt', 'cards.moments', 'cards.momentsNote', 'cards.momentsNone', 'cards.tagsAbsent', 'cards.takeHome',
  'cards.countAgainst', 'cards.thresholdWord', 'cards.checkTag', 'cards.question', 'cards.note', 'cards.noteLimit', 'cards.routeTitle', 'cards.routes.watch',
  'cards.routes.drill', 'cards.routes.set', 'cards.routeNotes.watch', 'cards.routeNotes.drill', 'cards.routeNotes.set', 'cards.setTempoLink', 'cards.setRuleOff', 'cards.setNoTempo', 'cards.openCards', 'cards.openCountLoading', 'cards.openCountUnknown', 'cards.file',
  'cards.cancel', 'cards.filing', 'cards.refusals.cap_reached', 'cards.refusals.moment_not_found', 'cards.refusals.source_changed', 'cards.refusals.disabled', 'cards.refusals.note_too_long', 'cards.refusals.note_control_char', 'cards.refusals.note_empty',
  'cards.refusals.version_conflict', 'cards.refusals.shelved', 'cards.refusals.untaped', 'cards.refusals.archetype_changed', 'cards.refusals.op_conflict', 'cards.refusals.tape_unreadable', 'cards.refusals.tape_not_found',
  'cards.refusals.tags_unavailable', 'cards.refusals.question_not_on_menu', 'cards.refusals.illegal_transition', 'cards.refusals.forbidden', 'cards.refusals.not_found', 'cards.refusals.default', 'cards.refusals.retireDefault', 'cards.filedCard', 'cards.situation', 'cards.on',
  'cards.route', 'cards.stage', 'cards.stageWords.card', 'cards.stageWords.nominated', 'cards.stageWords.retired', 'cards.stateNotes.retired', 'cards.stateNotes.shelved', 'cards.retire', 'cards.retiring', 'cards.recurrences',
  'cards.noRecurrence', 'cards.recurrencesWord', 'cards.unavailableDays()', 'cards.otherBattle', 'cards.otherBattleUnreadable', 'cards.noWatchCards', 'cards.myCards', 'cards.groups.active', 'cards.groups.shelved', 'cards.groups.retired', 'cards.groups.other', 'cards.noCards', 'cards.shelvedExplainer',
  'cards.loading', 'cards.readError', 'cards.openCard',
];

/** Every function key's sample calls — each tuple is one call; every one is swept. */
const SAMPLE_CALLS = {
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
  'sector()': [['XLK']],
  'meetingAt()': [['2:15 PM'], ['Sep 22, 8:30 PM']],
  'coverageSummary.notCharted()': [[1], [2]],
  'cards.unavailableDays()': [[1], [3]],
};

const COPY_EXPORTS = ['CLASS_LETTER', 'DIRECTIVE_EXPLAINER', 'FILM_ROOM_COPY', 'FORBIDDEN_WORDS', 'LOCKED_BASIS_NOTE', 'PROVENANCE_LABELS', 'REPLAY_SENTENCE', 'REPLAY_VERSION_NOTE'];
const EXIT_MAKER_KEYS = ['agent.short', 'agent.swap', 'agent.exit', 'agent.entry', 'platform.short', 'platform.swap', 'platform.exit', 'platform.noReason', 'platform.entry', 'gameplan.short', 'gameplan.swap', 'gameplan.exit', 'gameplan.entry', 'unrecorded.short', 'unrecorded.swap', 'unrecorded.exit', 'unrecorded.entry'];
// review A2FV3-7: the check states' words, a keyed table — pinned like the copy
const CHECK_STATE_KEYS = ['default_hold', 'swap', 'hold', 'completed', 'no_trigger', 'budget_skipped', 'deferred', 'gameplan_created', 'gameplan_pending', 'proposal_pending', 'degraded_quotes', 'cpu_passive', 'tick_error', 'no_record', 'unknown'];
const PLAN_DIRECTION_KEYS = ['potential_entry', 'potential_exit'];
// B2.1 A8 (A2F3-7, the rest): the composers' words, keyed tables pinned like the check states' — a new word fails until it is listed and swept
const ROLE_WORD_KEYS = ['exitedAt', 'enteredAt', 'unrecordedTime', 'swapBy', 'held', 'planned', 'series'];
const HOLDINGS_NOTE_KEYS = ['noRisk', 'notReconciled', 'derived'];
const RISK_WORD_KEYS = ['recorded', 'hold', 'none', 'actionNotRecorded'];
const DIRECTIVE_CARD_KEYS = ['filed', 'notFiled'];

// ── the model's composed words, from every branch of each reader ──────────────────────────────────────────────────
const CHECK_ROWS = [
  { state: 'completed', decision: { final: 'HOLD' } }, { state: 'completed', decision: { final: 'SWAP' } }, { state: 'completed' },
  { state: 'completed', decision: { final: 'HOLD', holdKind: 'default_failure' } },
  ...Object.keys(CHECK_STATE_TONES).map((state) => ({ state })), { state: 'not-a-state' }, { state: 'toString' },
];
const MECHANISMS = ['agent_decision', 'platform_risk_manager', 'archetype_rotation', 'guardrail', 'gameplan_meeting', undefined];
function modelWords() {
  const out = [];
  CHECK_ROWS.forEach((r) => out.push([`checkStateOf(${r.state}${r.decision ? ` ${r.decision.final}${r.decision.holdKind ? ' default' : ''}` : ''})`, checkStateOf(r).label]));
  for (const mechanism of MECHANISMS) for (const exitReason of ['stagnation', undefined]) out.push([`exitMakerOf(${mechanism}, ${exitReason})`, exitMakerOf({ mechanism, exitReason }).label]);
  // B2.1 A4 (RJ-4): the bought name's maker, on every branch
  for (const mechanism of MECHANISMS) for (const exitReason of ['stagnation', undefined]) out.push([`entryMakerOf(${mechanism}, ${exitReason})`, entryMakerOf({ mechanism, exitReason }).label]);
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
  for (const k of CHECK_STATE_KEYS) out.push([`CHECK_STATE_WORDS.${k}`, CHECK_STATE_WORDS[k]]);
  for (const k of ROLE_WORD_KEYS) out.push([`ROLE_WORDS.${k}`, ROLE_WORDS[k]]);
  for (const k of HOLDINGS_NOTE_KEYS) out.push([`HOLDINGS_NOTES.${k}`, HOLDINGS_NOTES[k]]);
  for (const k of RISK_WORD_KEYS) out.push([`RISK_WORDS.${k}`, RISK_WORDS[k]]);
  for (const k of DIRECTIVE_CARD_KEYS) out.push([`DIRECTIVE_CARD_WORDS.${k}`, DIRECTIVE_CARD_WORDS[k]]);
  out.push(...modelWords());
  out.push(['INTRADAY_DIAGNOSTIC_HEADER', INTRADAY_DIAGNOSTIC_HEADER]);
  // B2: the situation titles and the question menu the regions say in the screen's own voice (data modules, swept here)
  for (const id of LIVE_SITUATION_IDS) out.push([`SITUATIONS.${id}.title`, SITUATIONS[id].title]);
  for (const q of SITUATION_QUESTIONS) out.push([`SITUATION_QUESTIONS.${q.id}`, q.text]);
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
    expect(keysOf(CHECK_STATE_WORDS)).toEqual(CHECK_STATE_KEYS);
    expect(keysOf(ROLE_WORDS)).toEqual(ROLE_WORD_KEYS);
    expect(keysOf(HOLDINGS_NOTES)).toEqual(HOLDINGS_NOTE_KEYS);
    expect(keysOf(RISK_WORDS)).toEqual(RISK_WORD_KEYS);
    expect(keysOf(DIRECTIVE_CARD_WORDS)).toEqual(DIRECTIVE_CARD_KEYS);
    // every state a check row can be read as has its words: each tone's state, and each word's state is read
    for (const s of Object.keys(CHECK_STATE_TONES)) expect(CHECK_STATE_WORDS[s], s).toBe(checkStateOf({ state: s }).label);
    expect(CHECK_ROWS.map((r) => checkStateOf(r).key).filter((k, i, a) => a.indexOf(k) === i).sort()).toEqual([...CHECK_STATE_KEYS].sort());
  });

  it('every entry is a non-empty string and passes the screen\'s own-voice sweep — no forbidden word, no quantity word', () => {
    const entries = inventory();
    for (const [key, text] of entries) {
      expect(typeof text === 'string' && text.length > 0, key).toBe(true);
      expect(swept(text), `${key}: “${text}”`).toEqual([]);
    }
  });

  it('the inventory\'s size is pinned (the build report states it): 361 copy keys, 508 swept entries', () => {
    expect(COPY_KEYS).toHaveLength(361);   // Amendment K RK-2: cards.setNoTempo (360 before); Astra F1: the two point legends (237 before); stock thresholds v2 B3-6: atrXMeasured (239 before); Film Room B2: the card's 75 keys and quoteBy.you (240 before; 59 keys before its review round)
    expect(inventory()).toHaveLength(508);   // RK-2: one entry (507 before); B2: 76 keys, the one live situation's title and its three questions (348 before)
  });

  it('B2.1 A8 (A2F1-7): every fixed-digit exemption is bound to its copy key — the harness\x27s pinned text is production\x27s at that key, and every entry of the inventory that spells a digit is pinned', () => {
    const at = (key) => (key.startsWith('FILM_ROOM_COPY.') ? leaf(FILM_ROOM_COPY, key.slice('FILM_ROOM_COPY.'.length)) : key === 'LOCKED_BASIS_NOTE' ? LOCKED_BASIS_NOTE : key.startsWith('PROVENANCE_LABELS.') ? PROVENANCE_LABELS[key.slice('PROVENANCE_LABELS.'.length)] : undefined);
    for (const [key, text] of Object.entries(SPEC_FIXED_DIGIT_COPY)) expect(at(key), key).toBe(text);
    const pinned = new Set(Object.keys(SPEC_FIXED_DIGIT_COPY).map((k) => k.replace(/^FILM_ROOM_COPY\./, '')));
    // a function key's sample calls carry the caller's clocks and counts, and a reader's words its clocks (each renders
    // them as an instant or a marked number): only a digit outside a clock is a fixed phrase
    const digits = inventory().filter(([key, text]) => /\d/.test(text.replace(/\b\d{1,2}:\d{2}( (AM|PM))?\b/g, '')) && !/#\d+$/.test(key)).map(([key]) => key);
    expect(digits.filter((k) => !pinned.has(k))).toEqual([]);
    expect(digits.sort()).toEqual([...pinned].sort());
  });

  it('the inventory bites: an added key is seen, and a quantity word in an entry is caught', () => {
    expect(keysOf({ ...FILM_ROOM_COPY, sinceLastTime: 'Since last time' })).not.toEqual(COPY_KEYS);
    expect(keysOf({ ...FILM_ROOM_COPY, runKinds: { ...FILM_ROOM_COPY.runKinds, extra: 'x' } })).not.toEqual(COPY_KEYS);
    expect(swept('a hundred checks')).toEqual(['number word “hundred”: a hundred checks']);
    expect(swept('the best entry')).toEqual(['best']);
  });
});
