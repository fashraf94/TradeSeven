// src/screens/battleView/cockpitModel.test.js
//
// Cockpit Build 2a — THE COCKPIT'S VIEW MODEL (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md §7, §8.3, §11 "Client"): every row of the
// §7.3 matrix with its buttons drawn from the shared legality module; the
// one-call-at-a-time rule as the answer endpoint's own predicate (a parity
// table runs both); every row of §7.4 and the coverage of every fact the
// writers can emit; Amendment C-6 folding (the key, the 1 % tolerance against
// the newer level, the live-answer rule, newest-call answering); the groups;
// Monitoring; the sheet; every §8.3 refusal line from a mocked body.
//
// Dependency-surface guard (BUILD_RULES §4): the shared modules this model
// imports from api/ (copy.js, answers.js, horizon.js, controlPromptRenderer.js)
// are imported for real — never mocked — so a node-only import in any of them
// reds here as well as in the vite build.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COCKPIT_GROUP, THREAD_LEVEL_TOLERANCE, EARLIER_SHOWN, MONITORING_MAX,
  cockpitCalls, eventsByCall, promptBuiltAtOf, latestPromptBuiltAt, threadKeyOf, levelsWithin, foldThreads,
  factTag, callTag, kindLabelOf, answerLabelOf, overrideBlockOf, tileOf, buildCockpitFeed, monitoringRow,
  receiptLineOf, observationLineOf, citedPriceOf, sheetOf, checkOf, refusalLineOf, PENDING_REFUSAL_GRACE_MS,
} from './cockpitModel';
import { BATTLE_VIEW_COPY as COPY, COCKPIT_FACT_TAGS, cockpitRefusalLine } from './battleViewCopy';
import { tileAnswersFor } from '../../../api/_utils/callRecords/answers.js';
import { renderCallLine, renderUpsideLine, SAID_UNVERIFIED_LABEL } from '../../../api/_utils/callRecords/copy.js';
import { CALL_EVENT_KINDS } from '../../../api/_utils/callRecords/events.js';
import { isCallDirectivePendingAt } from '../../../api/_utils/directiveUtils.js';
import { deriveKilledDirectiveIds } from '../../../api/_utils/controlPromptRenderer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
// Line endings normalized: a CRLF checkout must scan exactly what an LF one does.
const src = (rel) => readFileSync(resolve(REPO, rel), 'utf8').replace(/\r\n/g, '\n');

const T = (iso) => Date.parse(iso);
/** Wed Sep 9 2026, 11:05 AM ET (EDT). */
const NOW = T('2026-09-09T15:05:00.000Z');
const P1030 = '2026-09-09T14:30:20.000Z';
const P1045 = '2026-09-09T14:45:20.000Z';
const P1100 = '2026-09-09T15:00:20.000Z';
const EVALS = [
  { evalId: 'eval_010', timestamp: '2026-09-09T14:30:45.000Z', promptBuiltAt: P1030, evidence: { AMD: { px: 158.4 }, KO: { px: 62.1 } } },
  { evalId: 'eval_011', timestamp: '2026-09-09T14:45:45.000Z', promptBuiltAt: P1045 },
  { evalId: 'eval_012', timestamp: '2026-09-09T15:00:45.000Z', promptBuiltAt: P1100 },
];
const CLOSE = T('2026-09-09T20:00:00.000Z');

let seq = 0;
/** A stored call record as candidate.js composes it (Amendment C fields included), minted under 'on'. */
const call = (over = {}) => {
  seq += 1;
  return {
    callId: `b:eval_010:call:${seq}`, kind: 'called_shot', battleId: 'b', evalId: 'eval_010', evalSeq: 10,
    mintedAt: T('2026-09-09T14:31:00.000Z'), mintedMode: 'on',
    symbol: 'AMD', direction: 'entry', heldAtMint: false, slot: 'support', counterpart: 'KO', counterpartRaw: null,
    condition: { side: 'above', level: 161 },
    horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' },
    defaultAction: 'act', said: 'AMD above $161 by the close.', saidOk: true,
    evidence: { tickId: 'tick-10', availability: 'unresolved', priceAsOf: P1030 },
    hypothesisRef: null, origin: 'declared',
    state: 'open', stateChangedAt: T('2026-09-09T14:31:00.000Z'), stateSource: 'mint',
    playerResponse: null, directiveThreadId: null, outcome: null, refused: null,
    ...over,
  };
};
/** The restatement one check later: same key, a level within 1 % of the newer one. */
const restated = (first, over = {}) => call({
  evalId: 'eval_011', evalSeq: 11, mintedAt: T('2026-09-09T14:46:00.000Z'),
  condition: { side: first.condition.side, level: 162 },
  evidence: { tickId: 'tick-11', availability: 'unresolved', priceAsOf: P1045 },
  symbol: first.symbol, direction: first.direction, slot: first.slot, defaultAction: first.defaultAction, kind: first.kind,
  ...over,
});
const ack = (c, filedAt = '2026-09-09T14:32:10.000Z') => ({ answer: c.defaultAction === 'hold' ? 'hold' : 'go', kind: 'ack', callId: c.callId, filedAt });
const directive = (c, { heardEvalId = null, filedAt = '2026-09-09T14:33:00.000Z', answer = 'hold' } = {}) => ({
  answer, kind: 'directive', directiveThreadId: `th-${c.callId}`, callId: c.callId, filedAt, heardEvalId,
});
const feed = (calls, over = {}) => buildCockpitFeed({ calls, events: [], evaluations: EVALS, directive: null, nowMs: NOW, ...over });
const allTiles = (f) => [...f.needsYou, ...f.waiting, ...f.earlier];
const tileFor = (f, c) => allTiles(f).find((t) => t.calls.some((x) => x.callId === c.callId));
const buttonsOf = (t) => t.buttons.map((b) => ({ answer: b.answer, label: b.label, row: b.row, disabled: b.disabled }));

// ---------------------------------------------------------------------------

describe('§7.3 — the matrix, every row; the buttons are the shared legality table', () => {
  it('a called shot, entry, default act, not held → Called shot · "Go if it triggers" (go, free) · "Hold off · 1 message" (hold)', () => {
    const c = call();
    const t = tileFor(feed([c]), c);
    expect(t.kindLabel).toBe('Called shot');
    expect(buttonsOf(t)).toEqual([
      { answer: 'go', label: 'Go if it triggers', row: 'ack', disabled: false },
      { answer: 'hold', label: 'Hold off · 1 message', row: 'directive', disabled: false },
    ]);
    expect(t.group).toBe(COCKPIT_GROUP.NEEDS_YOU);
  });

  it('a confirmation (exit, default act) → Confirmation · "Confirm" (go) · "Hold off · 1 message" (hold)', () => {
    const c = call({ kind: 'confirmation', direction: 'exit', symbol: 'KO', counterpart: null, condition: { side: 'below', level: 60 } });
    const t = tileFor(feed([c]), c);
    expect(t.kindLabel).toBe('Confirmation');
    expect(buttonsOf(t)).toEqual([
      { answer: 'go', label: 'Confirm', row: 'ack', disabled: false },
      { answer: 'hold', label: 'Hold off · 1 message', row: 'directive', disabled: false },
    ]);
  });

  it('a called shot with default hold — entry AND exit, not held → Called shot · "Hold" (hold) · "Go instead · 1 message" (go_now)', () => {
    for (const direction of ['entry', 'exit']) {
      const c = call({ defaultAction: 'hold', direction });
      const t = tileFor(feed([c]), c);
      expect(t.kindLabel).toBe('Called shot');
      expect(buttonsOf(t)).toEqual([
        { answer: 'hold', label: 'Hold', row: 'ack', disabled: false },
        { answer: 'go_now', label: 'Go instead · 1 message', row: 'directive', disabled: false },
      ]);
    }
  });

  it('heldAtMint → Upside call, NO buttons, Waiting, and its line has no action clause (C-2)', () => {
    const c = call({ heldAtMint: true });
    const t = tileFor(feed([c]), c);
    expect(t.kindLabel).toBe('Upside call');
    expect(t.upside).toBe(true);
    expect(t.buttons).toEqual([]);
    expect(t.group).toBe(COCKPIT_GROUP.WAITING);
    expect(t.line).toBe(renderUpsideLine(c, { nowMs: NOW, clock: '12h' }));
    expect(t.line).toBe("AMD above $161.00 by today's close");
  });

  it('a pick is not shown in 2a — no tile, in any group', () => {
    const pick = call({ kind: 'pick', symbol: null, direction: null, condition: null, defaultAction: null, swapOut: 'KO', options: [{ symbol: 'AMD', why: 'x' }] });
    const f = feed([pick]);
    expect(allTiles(f)).toEqual([]);
    expect(f.empty).toBe(true);
  });

  it('the buttons ARE tileAnswersFor(call) — the very table the endpoint enforces — in its order, with nothing added', () => {
    const fixtures = [
      call(), call({ kind: 'confirmation', direction: 'exit' }), call({ defaultAction: 'hold' }),
      call({ defaultAction: 'hold', direction: 'exit' }), call({ heldAtMint: true }), call({ defaultAction: null }),
    ];
    for (const c of fixtures) {
      const t = tileFor(feed([c]), c);
      expect(t.buttons.map(({ answer, row }) => ({ answer, row }))).toEqual(tileAnswersFor(c));
      expect(t.buttons.every((b) => b.callId === c.callId)).toBe(true);
    }
  });

  it('a call with no legal answers shows none and waits (never a guessed button)', () => {
    const c = call({ defaultAction: null });
    const t = tileFor(feed([c]), c);
    expect(t.buttons).toEqual([]);
    expect(t.group).toBe(COCKPIT_GROUP.WAITING);
  });

  it('the plain line is the shared renderer on the 12-hour clock; the eyebrow is "from the {t} check"', () => {
    const c = call({ horizon: { phrase: 'by 2pm', expiresAt: T('2026-09-09T18:00:00.000Z'), basis: 'explicit' } });
    const t = tileFor(feed([c]), c);
    expect(t.line).toBe(renderCallLine(c, { nowMs: NOW, clock: '12h' }));
    expect(t.line).toBe('AMD above $161.00 by 2:00 PM');
    expect(t.eyebrow).toBe('from the 10:30 AM check');
  });

  it('answerLabelOf names only the three tile answers, and kindLabelOf nothing for a pick', () => {
    expect(answerLabelOf(call(), 'pick')).toBeNull();
    expect(kindLabelOf({ kind: 'pick' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('§7.3 — one call at a time: the answer endpoint\'s own predicate', () => {
  const pendingCall = call({ playerResponse: null });
  const slotFor = (c, over = {}) => ({
    family: 'call', text: "Hold off on AMD until today's close", expiry: 'until_ms', expiresAtMs: CLOSE,
    directiveThreadId: `th-${c.callId}`, createdAt: '2026-09-09T14:33:00.000Z', callId: c.callId, kind: 'call_hold', ...over,
  });

  it('PARITY: on every row of the table, the tile blocks exactly when isCallDirectivePendingAt would refuse', () => {
    const base = slotFor(pendingCall);
    const directives = [
      base, { ...base, family: 'ordinary' }, { ...base, text: '' }, { ...base, directiveThreadId: null },
      { ...base, expiresAtMs: undefined }, { ...base, expiresAtMs: 'soon' }, { ...base, callId: undefined }, null,
    ];
    const nows = [NOW, CLOSE, CLOSE + 1, Number.NaN];
    const logs = [null, [], [{ suppressedDirectiveIds: [base.directiveThreadId] }], [{ suppressedDirectiveIds: ['th-other'] }]];
    const thisCalls = [pendingCall.callId, 'b:eval_099:call:0'];
    let rows = 0;
    for (const d of directives) for (const nowMs of nows) for (const log of logs) for (const suppressed of [false, true]) for (const thisCallId of thisCalls) {
      const server = isCallDirectivePendingAt({ directive: d, mode: 'on', nowMs, killedIds: deriveKilledDirectiveIds(log), thisCallId, suppressed });
      const block = overrideBlockOf({ directive: d, calls: [pendingCall], nowMs, controlEpochLog: log, suppressed });
      const client = Boolean(block) && block.callId !== thisCallId;
      expect({ d, nowMs, log, suppressed, thisCallId, client }).toEqual({ d, nowMs, log, suppressed, thisCallId, client: server });
      rows += 1;
    }
    expect(rows).toBe(8 * 4 * 4 * 2 * 2);
  });

  it('a pending, UNHEARD call directive disables every override with the spec\'s line; agreeing stays available', () => {
    const slotCall = call({ symbol: 'NVDA', playerResponse: directive({ callId: 'x' }) });
    slotCall.playerResponse = directive(slotCall);
    const other = call({ symbol: 'MU' });
    const f = feed([slotCall, other], { directive: slotFor(slotCall) });
    const t = tileFor(f, other);
    expect(buttonsOf(t)).toEqual([
      { answer: 'go', label: 'Go if it triggers', row: 'ack', disabled: false },
      { answer: 'hold', label: 'Hold off · 1 message', row: 'directive', disabled: true },
    ]);
    expect(t.blockedLine).toBe("Waiting · your last answer hasn't been heard yet.");
    expect(t.blockedLine).toBe(COPY.cockpitWaitingHeard);
  });

  it('HEAD DIFFERS FROM THE SPEC\'S WORDING: a HEARD call directive still blocks until it expires — and the line never says "not heard"', () => {
    const slotCall = call({ symbol: 'NVDA' });
    slotCall.playerResponse = directive(slotCall, { heardEvalId: 'eval_011' });
    const other = call({ symbol: 'MU' });
    const t = tileFor(feed([slotCall, other], { directive: slotFor(slotCall) }), other);
    expect(t.buttons.find((b) => b.row === 'directive').disabled).toBe(true);
    expect(t.blockedLine).toBe('Waiting · your last answer stays active until 4:00 PM.');
    expect(t.blockedLine).not.toContain('heard');
    // "Active", never "in force": the agent is coached, not compelled (review L6-8).
    expect(t.blockedLine).not.toContain('force');
  });

  it('a slot whose call is not among the loaded calls blocks with the active line (no claim about hearing)', () => {
    const other = call({ symbol: 'MU' });
    const t = tileFor(feed([other], { directive: slotFor({ callId: 'b:eval_001:call:9' }) }), other);
    expect(t.blockedLine).toBe('Waiting · your last answer stays active until 4:00 PM.');
  });

  it('nothing blocks once the slot expires, when it is killed, when the renderer suppresses it, or when it is not a call directive', () => {
    const slotCall = call({ symbol: 'NVDA' });
    slotCall.playerResponse = directive(slotCall);
    const other = call({ symbol: 'MU' });
    const cases = [
      { directive: slotFor(slotCall), nowMs: CLOSE + 1 },
      { directive: slotFor(slotCall), controlEpochLog: [{ suppressedDirectiveIds: [`th-${slotCall.callId}`] }] },
      { directive: slotFor(slotCall), suppressed: true },
      { directive: { text: 'Lean defensive', directiveThreadId: 't-9', expiry: 'end_of_battle' } },
    ];
    for (const over of cases) {
      const t = tileFor(feed([slotCall, other], over), other);
      expect(t.buttons.every((b) => b.disabled === false)).toBe(true);
      expect(t.blockedLine).toBeNull();
    }
  });

  it('the 409 directive_pending line claims only what the records show (review L6-5)', () => {
    const slotCall = call({ symbol: 'NVDA' });
    slotCall.playerResponse = directive(slotCall);
    const other = call({ symbol: 'MU' });
    const body = { error: 'refused', reason: 'directive_pending', pendingDirectiveThreadId: `th-${slotCall.callId}`, pendingCallId: slotCall.callId };
    const outcome = { status: 409, body, at: NOW, callId: other.callId };
    const lineFor = (calls, over = {}) => tileFor(feed(calls, { directive: slotFor(slotCall), outcomes: { [other.callId]: outcome }, ...over }), other).refusalLine;
    // The pending call is loaded and unheard → the spec's line.
    expect(lineFor([slotCall, other])).toBe("Waiting · your last answer hasn't been heard yet. One call at a time.");
    // …heard → the active line, with the slot's own time.
    slotCall.playerResponse = directive(slotCall, { heardEvalId: 'eval_011' });
    expect(lineFor([slotCall, other])).toBe('Waiting · your last answer stays active until 4:00 PM. One call at a time.');
    // …not among the loaded calls → no claim about hearing at all.
    expect(lineFor([other])).toBe('Waiting · your last answer stays active until 4:00 PM. One call at a time.');
    expect(lineFor([other], { directive: null })).toBe('Waiting · your last answer is still active. One call at a time.');
  });

  it('a directive_pending refusal stands while the block does; once the client sees no block it ages out (clock skew grace)', () => {
    const slotCall = call({ symbol: 'NVDA' });
    slotCall.playerResponse = directive(slotCall);
    const other = call({ symbol: 'MU' });
    const body = { error: 'refused', reason: 'directive_pending', pendingDirectiveThreadId: `th-${slotCall.callId}`, pendingCallId: slotCall.callId };
    const at = NOW;
    const tile = (nowMs, dir = slotFor(slotCall)) => tileFor(feed([slotCall, other], { directive: dir, nowMs, outcomes: { [other.callId]: { status: 409, body, at, callId: other.callId } } }), other);
    expect(tile(NOW + 60_000).refusalLine).toContain('One call at a time.'); // still blocked
    expect(PENDING_REFUSAL_GRACE_MS).toBe(30_000);
    expect(tile(NOW + 10_000, null).refusalLine).toContain('One call at a time.'); // no block seen, but fresh
    expect(tile(NOW + PENDING_REFUSAL_GRACE_MS + 1, null).refusalLine).toBeNull(); // no block, aged out
    expect(tile(CLOSE + PENDING_REFUSAL_GRACE_MS + 1).refusalLine).toBeNull(); // the directive expired
  });
});

// ---------------------------------------------------------------------------

describe('§7.4 — every state tag row, from record facts only', () => {
  const tagOf = (c, events = []) => callTag(c, { events, evaluations: EVALS, nowMs: NOW });
  const ev = (c, kind, promptBuiltAt, at = T('2026-09-09T15:01:00.000Z')) => ({ kind, at, callIds: [c.callId], text: '', evidence: promptBuiltAt ? { evalId: 'eval_012', promptBuiltAt, checkLabel: null } : {} });

  it('open, no answer → "Live" (neutral)', () => {
    expect(tagOf(call())).toEqual({ fact: 'state:open', tone: 'neutral', text: 'Live' });
  });
  it('answered with an agreement → "You agreed · {t}" (teal outline)', () => {
    const c = call(); c.playerResponse = ack(c);
    expect(tagOf(c)).toEqual({ fact: 'answer:ack', tone: 'yoursOutline', text: 'You agreed · 10:32 AM' });
  });
  it('a directive filed, not heard → "Filed · not yet heard" (teal)', () => {
    const c = call(); c.playerResponse = directive(c);
    expect(tagOf(c)).toEqual({ fact: 'answer:directive', tone: 'yours', text: 'Filed · not yet heard' });
  });
  it('a directive heard → "Heard at the {t} check" (teal), the check the record names', () => {
    const c = call(); c.playerResponse = directive(c, { heardEvalId: 'eval_011' });
    expect(tagOf(c)).toEqual({ fact: 'event:heard', tone: 'yours', text: 'Heard at the 10:45 AM check' });
  });
  it('hit with outcome.actedEvalId → "Acted at the {t} check" (emerald)', () => {
    const c = call({ state: 'hit', stateChangedAt: T('2026-09-09T15:00:30.000Z'), outcome: { actedEvalId: 'eval_012' } });
    expect(tagOf(c)).toEqual({ fact: 'event:acted', tone: 'acted', text: 'Acted at the 11:00 AM check' });
  });
  it('hit, not acted → "Hit at the {t} check" (neutral)', () => {
    const c = call({ state: 'hit', stateChangedAt: T('2026-09-09T15:00:30.000Z') });
    expect(tagOf(c)).toEqual({ fact: 'state:hit', tone: 'neutral', text: 'Hit at the 11:00 AM check' });
  });
  it('a no-matching-trade receipt → "No matching trade at the {t} check" (muted)', () => {
    const c = call(); c.playerResponse = directive(c, { heardEvalId: 'eval_012' });
    expect(tagOf(c, [ev(c, 'heard', P1100), ev(c, 'no_matching_trade', P1100)]))
      .toEqual({ fact: 'event:no_matching_trade', tone: 'muted', text: 'No matching trade at the 11:00 AM check' });
  });
  it('an answer replaced by a later one → "Replaced by a later answer" (muted)', () => {
    const c = call(); c.playerResponse = directive(c);
    expect(tagOf(c, [ev(c, 'superseded', null)])).toEqual({ fact: 'event:superseded', tone: 'muted', text: 'Replaced by a later answer' });
  });
  it('expired_unresolved → "Expired · {deadline}" (muted)', () => {
    const c = call({ state: 'expired_unresolved' });
    expect(tagOf(c)).toEqual({ fact: 'state:expired_unresolved', tone: 'muted', text: "Expired · by today's close" });
  });
  it('ended_with_battle → "Battle ended" (muted)', () => {
    expect(tagOf(call({ state: 'ended_with_battle' }))).toEqual({ fact: 'state:ended_with_battle', tone: 'muted', text: 'Battle ended' });
  });
  it('invalidated → "Dropped" (amber) — the bare fact: the call record carries no reason (review L6-4)', () => {
    expect(tagOf(call({ state: 'invalidated' }))).toEqual({ fact: 'state:invalidated', tone: 'dropped', text: 'Dropped' });
  });
  it('a missing time says the bare fact — never a guessed time', () => {
    const c = call(); c.playerResponse = { ...ack(c), filedAt: null };
    expect(tagOf(c).text).toBe('You agreed');
    const h = call(); h.playerResponse = directive(h, { heardEvalId: 'eval_gone' });
    expect(tagOf(h).text).toBe('Heard');
  });
  it('an OPEN call the agent already acted on → "Acted at the {t} check" (emerald), whoever stamped it (review L6-1)', () => {
    // The flip's whole-trade match on an open call: outcome.actedEvalId, no event.
    const flipped = call({ outcome: { actedEvalId: 'eval_012' } });
    expect(tagOf(flipped)).toEqual({ fact: 'event:acted', tone: 'acted', text: 'Acted at the 11:00 AM check' });
    // The heard pass: a directive answer heard and acted, with its acted event.
    const heardActed = call({ outcome: { actedEvalId: 'eval_011' } });
    heardActed.playerResponse = directive(heardActed, { heardEvalId: 'eval_011', answer: 'go_now' });
    expect(tagOf(heardActed, [ev(heardActed, 'heard', P1045), ev(heardActed, 'acted', P1045)])).toMatchObject({ fact: 'event:acted', text: 'Acted at the 10:45 AM check' });
    // …and it outranks an earlier no-matching-trade receipt.
    const later = call({ outcome: { actedEvalId: 'eval_012' } });
    later.playerResponse = directive(later, { heardEvalId: 'eval_011' });
    expect(tagOf(later, [ev(later, 'no_matching_trade', P1045)]).text).toBe('Acted at the 11:00 AM check');
  });

  it('the open call\'s other answer facts: the NEWEST by its check wins, ties in the order replaced · no matching trade · heard', () => {
    const c = call(); c.playerResponse = directive(c, { heardEvalId: 'eval_011' });
    // Heard at 10:45, no matching trade at 11:00 → the newer fact.
    expect(tagOf(c, [ev(c, 'no_matching_trade', P1100)]).text).toBe('No matching trade at the 11:00 AM check');
    // The same check: no matching trade outranks heard.
    expect(tagOf(c, [ev(c, 'no_matching_trade', P1045)]).text).toBe('No matching trade at the 10:45 AM check');
    // Heard at 11:00 after a replacement at 10:50 → Heard (the newer fact) …
    const h = call(); h.playerResponse = directive(h, { heardEvalId: 'eval_012' });
    expect(tagOf(h, [ev(h, 'superseded', null, T('2026-09-09T14:50:00.000Z'))]).text).toBe('Heard at the 11:00 AM check');
    // … and a replacement after the hearing reads Replaced.
    expect(tagOf(h, [ev(h, 'superseded', null, T('2026-09-09T15:02:00.000Z'))]).text).toBe('Replaced by a later answer');
  });

  it('a fact with no row renders NO tag: an unknown state, an unknown fact, a deliberately tagless event', () => {
    expect(callTag(call({ state: 'frozen' }), { evaluations: EVALS, nowMs: NOW })).toBeNull();
    expect(factTag('state:frozen')).toBeNull();
    expect(factTag('event:declared')).toBeNull();
    expect(factTag('event:answered')).toBeNull();
  });
});

describe('§7.4 — THE COVERAGE: the one table maps every fact the writers can emit at HEAD', () => {
  // The call states, read from the writers themselves so a new state reds here
  // until the table has its row: candidate.js mints open | invalidated, flip.js
  // decides hit | expired_unresolved, sweep.js expired_unresolved |
  // ended_with_battle.
  const writerStates = () => {
    const states = new Set();
    const cand = /state: reason \? '([a-z_]+)' : '([a-z_]+)'/.exec(src('api/_utils/callRecords/candidate.js'));
    expect(cand).toBeTruthy();
    states.add(cand[1]); states.add(cand[2]);
    const flip = src('api/_utils/callRecords/flip.js');
    const decide = flip.slice(flip.indexOf('export function decideFlip'), flip.indexOf('\n}\n', flip.indexOf('export function decideFlip')));
    for (const m of decide.matchAll(/'([a-z_]+)'/g)) if (m[1] !== 'next_check') states.add(m[1]);
    const sweep = src('api/_utils/callRecords/sweep.js');
    for (const m of sweep.matchAll(/next(?: =|:) '([a-z_]+)'/g)) states.add(m[1]);
    return [...states].sort();
  };

  it('the writers emit exactly these call states (the scan is not vacuous)', () => {
    expect(writerStates()).toEqual(['ended_with_battle', 'expired_unresolved', 'hit', 'invalidated', 'open']);
  });

  it('every call state has a row WITH a tag', () => {
    for (const state of writerStates()) {
      expect(COCKPIT_FACT_TAGS).toHaveProperty(`state:${state}`);
      expect(COCKPIT_FACT_TAGS[`state:${state}`]).not.toBeNull();
    }
  });

  it('every CALL_EVENT_KINDS entry has a row (declared / answered deliberately tagless), and nothing else is an event row', () => {
    expect(CALL_EVENT_KINDS.length).toBeGreaterThan(0);
    for (const kind of CALL_EVENT_KINDS) expect(COCKPIT_FACT_TAGS).toHaveProperty(`event:${kind}`);
    const eventRows = Object.keys(COCKPIT_FACT_TAGS).filter((k) => k.startsWith('event:')).map((k) => k.slice(6)).sort();
    expect(eventRows).toEqual([...CALL_EVENT_KINDS].sort());
    expect(COCKPIT_FACT_TAGS['event:declared']).toBeNull();
    expect(COCKPIT_FACT_TAGS['event:answered']).toBeNull();
  });

  it('both playerResponse kinds the answer endpoint writes have a row with a tag', () => {
    const endpoint = src('api/agent/call-response.js');
    const kinds = [...endpoint.matchAll(/const playerResponse = \{[^}]*kind: '([a-z]+)'/g)].map((m) => m[1]).sort();
    expect(kinds).toEqual(['ack', 'directive']);
    for (const kind of kinds) expect(COCKPIT_FACT_TAGS[`answer:${kind}`]).toBeTruthy();
  });

  it('the table has no row for a fact nobody writes', () => {
    const known = new Set([
      ...['ended_with_battle', 'expired_unresolved', 'hit', 'invalidated', 'open'].map((s) => `state:${s}`),
      ...CALL_EVENT_KINDS.map((k) => `event:${k}`),
      'answer:ack', 'answer:directive',
    ]);
    expect(Object.keys(COCKPIT_FACT_TAGS).filter((k) => !known.has(k))).toEqual([]);
  });

  it('the words that never appear: Held off, Holding, Declined, Honored, Superseded, Asking you', () => {
    const banned = /\b(Held off|Holding|Declined|Honou?red|Superseded|Asking you)\b/i;
    const params = { check: 'the 10:30 AM check', time: '10:32 AM', deadline: "by today's close" };
    for (const [fact, row] of Object.entries(COCKPIT_FACT_TAGS)) {
      if (!row) continue;
      expect(row.text(params), fact).not.toMatch(banned);
      expect(row.text(), fact).not.toMatch(banned);
    }
    const cockpitStrings = Object.entries(COPY).filter(([k]) => k.startsWith('cockpit') || k === 'fromCockpit' || k === 'paneSectionChatUnread');
    for (const [key, value] of cockpitStrings) {
      const out = typeof value === 'function' ? [value('x', 'y', 'z', 'w'), value(3), value(null), value('hold', '10:32 AM', '10:30 AM')] : [value];
      for (const s of out) if (typeof s === 'string') expect(s, key).not.toMatch(banned);
    }
  });
});

// ---------------------------------------------------------------------------

describe('§7.2 — folding (Amendment C-6)', () => {
  it('THE KEY: same ET day, symbol, direction, slot and side fold; any one part different keeps them apart', () => {
    const a = call();
    const b = restated(a);
    expect(foldThreads([a, b])).toHaveLength(1);
    const variants = [
      restated(a, { symbol: 'MU' }),
      restated(a, { direction: 'exit' }),
      restated(a, { slot: 'core' }),
      restated(a, { condition: { side: 'below', level: 162 } }),
      restated(a, { mintedAt: T('2026-09-10T14:46:00.000Z') }), // the next ET trading day
    ];
    for (const v of variants) expect(foldThreads([a, v])).toHaveLength(2);
  });

  it('the ET day is ET\'s, not UTC\'s: 11:30 PM ET and 9:45 AM ET the next day never fold', () => {
    const late = call({ mintedAt: T('2026-09-10T03:30:00.000Z') }); // Sep 9, 11:30 PM ET
    const next = restated(late, { mintedAt: T('2026-09-10T13:45:00.000Z') }); // Sep 10, 9:45 AM ET
    expect(threadKeyOf(late)).not.toBe(threadKeyOf(next));
  });

  it('THE 1 % TOLERANCE is measured against the NEWER call\'s level', () => {
    expect(THREAD_LEVEL_TOLERANCE).toBe(0.01);
    const older = call({ condition: { side: 'above', level: 100 } });
    // |100 − 99| / 99 = 1.0101 % → apart (it would be exactly 1 % against the older level)
    expect(levelsWithin(older, restated(older, { condition: { side: 'above', level: 99 } }))).toBe(false);
    // |100 − 101| / 101 = 0.990 % → together
    expect(levelsWithin(older, restated(older, { condition: { side: 'above', level: 101 } }))).toBe(true);
    // exactly 1 %: |99 − 100| / 100
    expect(levelsWithin(call({ condition: { side: 'above', level: 99 } }), restated(older, { condition: { side: 'above', level: 100 } }))).toBe(true);
    const a = call({ condition: { side: 'above', level: 100 } });
    expect(foldThreads([a, restated(a, { condition: { side: 'above', level: 99 } })])).toHaveLength(2);
    expect(foldThreads([a, restated(a, { condition: { side: 'above', level: 101 } })])).toHaveLength(1);
  });

  it('resolved calls never join a thread', () => {
    const a = call({ state: 'hit', stateChangedAt: T('2026-09-09T14:40:00.000Z') });
    const b = restated(a, { state: 'open' });
    const f = feed([a, b]);
    expect(f.earlier).toHaveLength(1);
    expect(f.needsYou).toHaveLength(1);
    expect(f.needsYou[0].calls).toHaveLength(1);
  });

  it('one tile per thread, carrying the NEWEST call\'s wording and "Restated at the {t} check"', () => {
    const a = call();
    const b = restated(a);
    const f = feed([a, b]);
    expect(allTiles(f)).toHaveLength(1);
    const t = allTiles(f)[0];
    expect(t.id).toBe(b.callId);
    expect(t.line).toBe('AMD above $162.00 by today\'s close');
    expect(t.restated).toBe('Restated at the 10:45 AM check');
    expect(t.eyebrow).toBe('from the 10:30 AM check');
  });

  it('NEWEST-CALL ANSWERING: with no answer on the thread, the buttons answer the newest call', () => {
    const a = call();
    const b = restated(a);
    const t = allTiles(feed([a, b]))[0];
    expect(t.group).toBe(COCKPIT_GROUP.NEEDS_YOU);
    expect(t.buttons.map((x) => x.callId)).toEqual([b.callId, b.callId]);
  });

  it('THE LIVE-ANSWER RULE: a live directive answer anywhere on the thread is shown, naming its wording, and no button is offered', () => {
    const a = call();
    a.playerResponse = directive(a, { answer: 'hold', filedAt: '2026-09-09T14:33:00.000Z' });
    const b = restated(a);
    const t = allTiles(feed([a, b]))[0];
    expect(t.buttons).toEqual([]);
    expect(t.group).toBe(COCKPIT_GROUP.WAITING);
    expect(t.answerLine).toBe('You said hold off · 10:33 AM, on the 10:30 AM wording');
    expect(t.tag.text).toBe('Filed · not yet heard');
  });

  it('a single call with a live directive answer shows that answer too (a thread of one)', () => {
    const a = call({ defaultAction: 'hold' });
    a.playerResponse = directive(a, { answer: 'go_now', filedAt: '2026-09-09T14:34:00.000Z' });
    const t = allTiles(feed([a]))[0];
    expect(t.answerLine).toBe('You said go instead · 10:34 AM, on the 10:30 AM wording');
    expect(t.buttons).toEqual([]);
  });

  it('an AGREEMENT on an earlier wording is an answered thread (Waiting), and the restated call can still be answered (C-6 blocks only on a live directive)', () => {
    const a = call();
    a.playerResponse = ack(a);
    const b = restated(a);
    const t = allTiles(feed([a, b]))[0];
    expect(t.group).toBe(COCKPIT_GROUP.WAITING);
    expect(t.buttons.map((x) => [x.answer, x.callId])).toEqual([['go', b.callId], ['hold', b.callId]]);
    // The agreement is NOT worn by the newer wording (review L6-2): the tag is the
    // newest call's own, and the agreement is an answer line naming its wording.
    expect(t.tag.text).toBe('Live');
    expect(t.answerLine).toBe('You agreed · 10:32 AM, on the 10:30 AM wording');
  });

  it('an agreement over a REVERSED default (a Confirmed exit folded with a hold-default shot) never reads as agreement with the new wording (review L6-2)', () => {
    const conf = call({ kind: 'confirmation', direction: 'exit', symbol: 'KO', counterpart: null, condition: { side: 'below', level: 60 } });
    conf.playerResponse = ack(conf);
    const shot = restated(conf, { kind: 'called_shot', defaultAction: 'hold', condition: { side: 'below', level: 60.3 } });
    const t = allTiles(feed([conf, shot]))[0];
    expect(t.kindLabel).toBe('Called shot');
    expect(t.tag.text).toBe('Live');
    expect(t.answerLine).toBe('You agreed · 10:32 AM, on the 10:30 AM wording');
    expect(t.buttons.map((b) => b.label)).toEqual(['Hold', 'Go instead · 1 message']);
  });

  it('an open call past its deadline offers nothing (the endpoint refuses every answer then: 409 expired — review L6-7); it waits on the check', () => {
    const next = call({ horizon: { phrase: 'next_check', expiresAt: T('2026-09-09T15:00:00.000Z'), basis: 'next_check' } });
    const t = tileFor(feed([next]), next); // NOW is 11:05, the deadline 11:00
    expect(t.buttons).toEqual([]);
    expect(t.group).toBe(COCKPIT_GROUP.WAITING);
    expect(t.tag.text).toBe('Live'); // the record still says open — no guessed state
    const before = tileFor(feed([next], { nowMs: T('2026-09-09T14:59:59.000Z') }), next);
    expect(before.buttons.map((b) => b.answer)).toEqual(['go', 'hold']);
    const atDeadline = tileFor(feed([next], { nowMs: T('2026-09-09T15:00:00.000Z') }), next);
    expect(atDeadline.buttons).toEqual([]); // the endpoint refuses at deadline <= now
  });

  it('an open call the agent already acted on offers nothing and waits', () => {
    const c = call({ outcome: { actedEvalId: 'eval_012' } });
    const t = tileFor(feed([c]), c);
    expect(t.buttons).toEqual([]);
    expect(t.group).toBe(COCKPIT_GROUP.WAITING);
  });

  it('an act on ANY call of a thread is the thread\'s tag, and no answer follows it — even over a live directive (the agent heard "hold off" and traded anyway)', () => {
    const a = call();
    a.playerResponse = directive(a, { heardEvalId: 'eval_011' });
    a.outcome = { actedEvalId: 'eval_012' };
    const b = restated(a);
    const t = allTiles(feed([a, b]))[0];
    expect(t.tag).toMatchObject({ fact: 'event:acted', text: 'Acted at the 11:00 AM check' });
    expect(t.buttons).toEqual([]);
    expect(t.answerLine).toBe('You said hold off · 10:33 AM, on the 10:30 AM wording');
  });

  it('a call with no finite deadline offers nothing (the endpoint\'s guard: !finite(deadline) → 409 expired)', () => {
    const c = call({ horizon: { phrase: 'this_session', expiresAt: null, basis: 'this_session' } });
    expect(tileFor(feed([c]), c).buttons).toEqual([]);
  });

  it('the newest call already answered offers nothing more (the endpoint would answer 409 already_answered)', () => {
    const a = call();
    const b = restated(a);
    b.playerResponse = ack(b, '2026-09-09T14:47:00.000Z');
    const t = allTiles(feed([a, b]))[0];
    expect(t.buttons).toEqual([]);
    expect(t.group).toBe(COCKPIT_GROUP.WAITING);
    expect(t.tag.text).toBe('You agreed · 10:47 AM');
  });

  it('a thread is the connected set: three restatements chaining within 1 % fold into one tile', () => {
    const a = call({ condition: { side: 'above', level: 100 } });
    const b = restated(a, { condition: { side: 'above', level: 100.9 } });
    const c = restated(a, { evalId: 'eval_012', evalSeq: 12, mintedAt: T('2026-09-09T15:01:00.000Z'), condition: { side: 'above', level: 101.8 }, evidence: { priceAsOf: P1100 } });
    const tiles = allTiles(feed([a, b, c]));
    expect(tiles).toHaveLength(1);
    expect(tiles[0].calls.map((x) => x.callId)).toEqual([c.callId, b.callId, a.callId]);
  });

  it('a call missing a key part never folds (its own tile)', () => {
    const a = call();
    const b = restated(a, { slot: null });
    expect(threadKeyOf(b)).toBeNull();
    expect(foldThreads([a, b])).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------

describe('§7.1 — the groups, in order; Earlier ten then all; the empty state; C-5', () => {
  it('Needs you → open, legal, unanswered; Waiting → answered threads and upside calls; Earlier → resolved, newest first', () => {
    const open = call({ symbol: 'MU' });
    const answered = call({ symbol: 'NVDA' }); answered.playerResponse = ack(answered);
    const upside = call({ symbol: 'TSLA', heldAtMint: true });
    const hitOld = call({ symbol: 'AAPL', state: 'hit', stateChangedAt: T('2026-09-09T14:46:00.000Z') });
    const hitNew = call({ symbol: 'MSFT', state: 'expired_unresolved', stateChangedAt: T('2026-09-09T15:01:00.000Z') });
    const f = feed([open, answered, upside, hitOld, hitNew]);
    expect(f.needsYou.map((t) => t.call.symbol)).toEqual(['MU']);
    expect(f.waiting.map((t) => t.call.symbol).sort()).toEqual(['NVDA', 'TSLA']);
    expect(f.earlier.map((t) => t.call.symbol)).toEqual(['MSFT', 'AAPL']);
    expect(f.needsYouCount).toBe(1);
    expect(f.earlier.every((t) => t.group === COCKPIT_GROUP.EARLIER && t.buttons.length === 0)).toBe(true);
  });

  it('Earlier shows ten until "Show all"; the total is always the whole count', () => {
    expect(EARLIER_SHOWN).toBe(10);
    const resolved = Array.from({ length: 13 }, (_, i) => call({ symbol: `S${i}`, state: 'hit', stateChangedAt: T('2026-09-09T14:40:00.000Z') + i * 1000 }));
    const f = feed(resolved);
    expect(f.earlier).toHaveLength(10);
    expect(f.earlierTotal).toBe(13);
    expect(f.earlier[0].call.symbol).toBe('S12');
    expect(feed(resolved, { showAllEarlier: true }).earlier).toHaveLength(13);
    expect(COPY.cockpitShowAll(13)).toBe('Show all · 13');
  });

  it('no calls at all → empty (the screen shows the empty line); the line names the next check when known', () => {
    expect(feed([]).empty).toBe(true);
    expect(feed(null).empty).toBe(true);
    expect(COPY.cockpitEmpty('2026-09-09T15:15:00.000Z')).toBe('No calls yet. Your agent declares calls at its checks — next one ~11:15 AM.');
    expect(COPY.cockpitEmpty(null)).toBe('No calls yet. Your agent declares calls at its checks.');
  });

  it('C-5: only records minted under \'on\' are tiles — without the field (pre-amendment) or minted at shadow, never shown', () => {
    const shadow = call({ mintedMode: 'shadow' });
    const legacy = call(); delete legacy.mintedMode;
    expect(cockpitCalls([shadow, legacy])).toEqual([]);
    expect(feed([shadow, legacy]).empty).toBe(true);
  });
});

describe('Monitoring (§7.1) — one row, "From the {t} check", at most six names', () => {
  it('reads the record\'s check through the battle\'s own evaluations (the declarations record carries no promptBuiltAt at HEAD)', () => {
    const row = monitoringRow({ symbols: ['AMD', 'JPM'], evalId: 'eval_011', mintedAt: T('2026-09-09T14:46:00.000Z') }, EVALS);
    expect(row.from).toBe('From the 10:45 AM check');
    expect(row.chips.map((c) => c.symbol)).toEqual(['AMD', 'JPM']);
  });
  it('caps at six and keys every chip uniquely even when the record repeats a name', () => {
    expect(MONITORING_MAX).toBe(6);
    const row = monitoringRow({ symbols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A'], evalId: 'eval_011' }, EVALS);
    expect(row.chips).toHaveLength(6);
    expect(new Set(row.chips.map((c) => c.key)).size).toBe(6);
  });
  it('hidden without a record or without names; an evaluation no longer retained drops only the "From" line', () => {
    expect(monitoringRow(null, EVALS)).toBeNull();
    expect(monitoringRow({ symbols: [], evalId: 'eval_011' }, EVALS)).toBeNull();
    const row = monitoringRow({ symbols: ['AMD'], evalId: 'eval_001' }, EVALS);
    expect(row.from).toBeNull();
    expect(row.chips).toHaveLength(1);
  });
});

describe('the vintage and the evaluations lookups', () => {
  it('latestPromptBuiltAt is the newest retained check that built a prompt; promptBuiltAtOf finds one by evalId', () => {
    expect(latestPromptBuiltAt(EVALS)).toBe(new Date(P1100).toISOString());
    expect(latestPromptBuiltAt([...EVALS, { evalId: 'eval_013', promptBuiltAt: null }])).toBe(new Date(P1100).toISOString());
    expect(promptBuiltAtOf(EVALS, 'eval_010')).toBe(new Date(P1030).toISOString());
    expect(promptBuiltAtOf(EVALS, 'nope')).toBeNull();
    expect(COPY.cockpitVintage(checkOf(P1100), '2026-09-09T15:15:00.000Z')).toBe('Prices as of the 11:00 AM check · next ~11:15 AM');
    expect(COPY.cockpitVintage(null, null)).toBeNull();
    expect(COPY.cockpitMessagesLeft(7)).toBe('7 messages left');
    expect(COPY.cockpitMessagesLeft(1)).toBe('1 message left');
  });
});

// ---------------------------------------------------------------------------

describe('§7.5 — the sheet, from records alone', () => {
  const evs = (c) => [
    { kind: 'declared', at: T('2026-09-09T14:31:00.000Z'), callIds: [c.callId], text: '' },
    { kind: 'heard', at: T('2026-09-09T14:46:00.000Z'), callIds: [c.callId], evidence: { evalId: 'eval_011', promptBuiltAt: P1045 } },
    { kind: 'answered', at: T('2026-09-09T14:33:00.000Z'), callIds: [c.callId], text: '' },
    { kind: 'acted', at: T('2026-09-09T15:01:00.000Z'), callIds: [c.callId], evidence: { evalId: 'eval_012', promptBuiltAt: P1100 } },
  ];

  it('title = the plain line; the agent\'s sentence ONLY when saidOk === true, under the unverified label', () => {
    const ok = call();
    const s = sheetOf(tileFor(feed([ok]), ok), { evaluations: EVALS, nowMs: NOW });
    expect(s.title).toBe("AMD above $161.00 by today's close");
    expect(s.said).toEqual({ label: SAID_UNVERIFIED_LABEL, text: 'AMD above $161 by the close.' });
    for (const saidOk of [false, null, undefined, 'true']) {
      const c = call({ saidOk });
      expect(sheetOf(tileFor(feed([c]), c), { evaluations: EVALS, nowMs: NOW }).said).toBeNull();
    }
  });

  it('facts: the level, the deadline, the price at the citing check ("as of the {t} check")', () => {
    const c = call();
    const s = sheetOf(tileFor(feed([c]), c), { evaluations: EVALS, nowMs: NOW });
    expect(s.facts).toEqual([
      { key: 'level', label: 'Level', value: 'above $161.00' },
      { key: 'deadline', label: 'Deadline', value: "by today's close" },
      { key: 'price', label: 'Price', value: '$158.40 · as of the 10:30 AM check' },
    ]);
    expect(citedPriceOf(call({ symbol: 'ZZZ' }), EVALS)).toBeNull();
  });

  it('the default as an intent: "If you say nothing · intent: …"; none at all for an upside call', () => {
    const entry = call();
    expect(sheetOf(tileFor(feed([entry]), entry), { evaluations: EVALS, nowMs: NOW }).defaultLine).toBe('If you say nothing · intent: bring in AMD for KO');
    const exit = call({ direction: 'exit', counterpart: null });
    expect(sheetOf(tileFor(feed([exit]), exit), { evaluations: EVALS, nowMs: NOW }).defaultLine).toBe('If you say nothing · intent: exit AMD');
    const hold = call({ defaultAction: 'hold' });
    expect(sheetOf(tileFor(feed([hold]), hold), { evaluations: EVALS, nowMs: NOW }).defaultLine).toBe('If you say nothing · intent: hold');
    const up = call({ heldAtMint: true });
    expect(sheetOf(tileFor(feed([up]), up), { evaluations: EVALS, nowMs: NOW }).defaultLine).toBeNull();
  });

  it('an upside call never shows its own sentence, even when the lint passed it (C-2 removes the action clause everywhere — review L6-9)', () => {
    const up = call({ heldAtMint: true, said: 'AMD above $161 by the close, so I add to it for KO.', saidOk: true });
    expect(sheetOf(tileFor(feed([up]), up), { evaluations: EVALS, nowMs: NOW }).said).toBeNull();
  });

  it('receipts from callEvents, OLDEST FIRST: Filed → Heard → Acted, each with its time; the declaration is not a receipt', () => {
    const c = call({ state: 'hit', stateChangedAt: T('2026-09-09T15:00:30.000Z'), outcome: { actedEvalId: 'eval_012' } });
    c.playerResponse = directive(c, { heardEvalId: 'eval_011' });
    const events = evs(c);
    const s = sheetOf(tileFor(feed([c], { events }), c), { eventsMap: eventsByCall(events), evaluations: EVALS, nowMs: NOW });
    expect(s.receipts.map((r) => r.text)).toEqual(['Filed 10:33 AM', 'Heard at the 10:45 AM check', 'Acted at the 11:00 AM check']);
  });

  it('an act the flip recorded WITHOUT an event still reads as a receipt — from the record\'s own outcome.actedEvalId (review L6-1 / V2)', () => {
    const c = call({ state: 'expired_unresolved', stateChangedAt: T('2026-09-09T20:05:00.000Z'), outcome: { actedEvalId: 'eval_012' } });
    const s = sheetOf(tileFor(feed([c]), c), { evaluations: EVALS, nowMs: NOW });
    expect(s.receipts.map((r) => r.text)).toEqual(['Acted at the 11:00 AM check']);
    // …and never twice when the acted event exists.
    const d = call({ outcome: { actedEvalId: 'eval_012' } });
    const events = [{ kind: 'acted', at: T('2026-09-09T15:01:00.000Z'), callIds: [d.callId], evidence: { evalId: 'eval_012', promptBuiltAt: P1100 } }];
    expect(sheetOf(tileFor(feed([d], { events }), d), { eventsMap: eventsByCall(events), evaluations: EVALS, nowMs: NOW }).receipts.map((r) => r.text)).toEqual(['Acted at the 11:00 AM check']);
  });

  it('receipts are ordered by the CHECK each names, not the writer\'s instant (a sweep-repaired "heard" carries the sweep\'s time — review L6-11)', () => {
    const c = call({ state: 'expired_unresolved', stateChangedAt: T('2026-09-09T20:05:00.000Z') });
    c.playerResponse = directive(c, { heardEvalId: 'eval_011' });
    const events = [
      { kind: 'answered', at: T('2026-09-09T14:33:00.000Z'), callIds: [c.callId] },
      { kind: 'expired', at: T('2026-09-09T20:05:00.000Z'), callIds: [c.callId], evidence: {} },
      // repaired by the sweep at 4:10 PM, naming the 10:45 check
      { kind: 'heard', at: T('2026-09-09T20:10:00.000Z'), callIds: [c.callId], evidence: { evalId: 'eval_011', promptBuiltAt: P1045 } },
    ];
    const s = sheetOf(tileFor(feed([c], { events }), c), { eventsMap: eventsByCall(events), evaluations: EVALS, nowMs: NOW });
    expect(s.receipts.map((r) => r.text)).toEqual(['Filed 10:33 AM', 'Heard at the 10:45 AM check', "Expired · by today's close"]);
  });

  it('a resolved call adds its observed price from callObservations ("Hit at $609.80 · the 1:45 PM check")', () => {
    const c = call({ state: 'hit', stateChangedAt: T('2026-09-09T17:45:30.000Z') });
    const observation = { px: 609.8, observedAtMs: T('2026-09-09T17:45:10.000Z') };
    const s = sheetOf(tileFor(feed([c]), c), { evaluations: EVALS, observation, nowMs: NOW });
    expect(s.receipts.at(-1).text).toBe('Hit at $609.80 · the 1:45 PM check');
    expect(observationLineOf(call({ state: 'open' }), observation)).toBeNull();
    expect(observationLineOf(c, { px: null })).toBeNull();
  });

  it('every receipt kind renders from its record; the answer receipt follows the answer\'s kind', () => {
    const c = call(); c.playerResponse = ack(c);
    expect(receiptLineOf({ kind: 'answered', at: T('2026-09-09T14:32:10.000Z') }, c, { nowMs: NOW })).toBe('You agreed · 10:32 AM');
    expect(receiptLineOf({ kind: 'no_matching_trade', evidence: { promptBuiltAt: P1100 } }, c, { nowMs: NOW })).toBe('No matching trade at the 11:00 AM check');
    expect(receiptLineOf({ kind: 'expired' }, c, { nowMs: NOW })).toBe("Expired · by today's close");
    expect(receiptLineOf({ kind: 'ended_with_battle' }, c, { nowMs: NOW })).toBe('Battle ended');
    expect(receiptLineOf({ kind: 'superseded', at: T('2026-09-09T14:50:00.000Z') }, c, { nowMs: NOW })).toBe('Replaced by a later answer · 10:50 AM');
    expect(receiptLineOf({ kind: 'declared' }, c, { nowMs: NOW })).toBeNull();
    expect(receiptLineOf({ kind: 'mystery' }, c, { nowMs: NOW })).toBeNull();
  });

  it('a folded thread lists each EARLIER wording with its own time — the original "Called at…", the rest "Restated at…" (review L6-3)', () => {
    const a = call();
    const b = restated(a);
    const s = sheetOf(allTiles(feed([a, b]))[0], { evaluations: EVALS, nowMs: NOW });
    expect(s.title).toBe("AMD above $162.00 by today's close");
    expect(s.restated).toEqual([{ key: a.callId, check: 'Called at the 10:30 AM check', line: "AMD above $161.00 by today's close" }]);
    expect(s.checkLink).toEqual({ evalId: 'eval_011', label: 'From the 10:45 AM check →' });
    // Three wordings: the middle one is a restatement, the oldest the original.
    const c = restated(a, { evalId: 'eval_012', evalSeq: 12, mintedAt: T('2026-09-09T15:01:00.000Z'), condition: { side: 'above', level: 162.5 }, evidence: { priceAsOf: P1100 } });
    const s3 = sheetOf(allTiles(feed([a, b, c]))[0], { evaluations: EVALS, nowMs: NOW });
    expect(s3.restated.map((r) => [r.key, r.check])).toEqual([[b.callId, 'Restated at the 10:45 AM check'], [a.callId, 'Called at the 10:30 AM check']]);
  });

  it('the sheet carries the tile\'s buttons, blocked line and pending line — the same answers as the tile', () => {
    const c = call();
    const t = tileFor(feed([c]), c);
    const s = sheetOf(t, { evaluations: EVALS, nowMs: NOW });
    expect(s.buttons).toBe(t.buttons);
    expect(s.blockedLine).toBe(t.blockedLine);
    expect(s.pendingLine).toBe(t.pendingLine);
    expect(sheetOf(null)).toBeNull();
  });
});

describe('tap state — no optimistic state; the pressed button reads "Sending…" and both disable', () => {
  it('while an answer is in flight for the tile, both buttons disable and only the pressed one changes its words', () => {
    const c = call();
    const t = tileFor(feed([c], { pending: { callId: c.callId, answer: 'hold' } }), c);
    expect(buttonsOf(t)).toEqual([
      { answer: 'go', label: 'Go if it triggers', row: 'ack', disabled: true },
      { answer: 'hold', label: 'Sending…', row: 'directive', disabled: true },
    ]);
    // …and the tile itself is unchanged: the same group, the same tag, no answer shown.
    expect(t.group).toBe(COCKPIT_GROUP.NEEDS_YOU);
    expect(t.tag.text).toBe('Live');
  });
  it('while ANY answer is in flight every button waits — the hook sends one at a time, so a tap elsewhere is never silently dropped (review L3-7)', () => {
    const c = call();
    const d = call({ symbol: 'MU' });
    const t = tileFor(feed([c, d], { pending: { callId: c.callId, answer: 'go' } }), d);
    expect(t.buttons.every((b) => b.disabled)).toBe(true);
    expect(t.buttons.map((b) => b.label)).toEqual(['Go if it triggers', 'Hold off · 1 message']); // only the pressed one reads "Sending…"
  });
});

describe('eventsByCall — grouped by every call id an event names, oldest first', () => {
  it('an event naming two calls lands under both; garbage is skipped', () => {
    const map = eventsByCall([
      { kind: 'heard', at: 3, callIds: ['a', 'b'] },
      { kind: 'answered', at: 1, callIds: ['a'] },
      null, { kind: 'x', callIds: [null, ''] },
    ]);
    expect(map.get('a').map((e) => e.kind)).toEqual(['answered', 'heard']);
    expect(map.get('b').map((e) => e.kind)).toEqual(['heard']);
    expect(map.size).toBe(2);
  });
  it('tileOf is total on a thread of one resolved call (no buttons, Earlier)', () => {
    const t = tileOf([call({ state: 'invalidated' })], { evaluations: EVALS, nowMs: NOW });
    expect(t.group).toBe(COCKPIT_GROUP.EARLIER);
    expect(t.buttons).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('the refusal line under a tile — chosen from the body, dropped once it no longer describes the tile (review L6-5, L6-6)', () => {
  const outcomeFor = (c, status, body) => ({ status, body, at: NOW, callId: c.callId });

  it('every tile carries its refusal line from the outcomes the screen holds; a tile without one has none', () => {
    const c = call();
    const d = call({ symbol: 'MU' });
    const f = feed([c, d], { outcomes: { [c.callId]: outcomeFor(c, 409, { error: 'refused', reason: 'budget' }) } });
    expect(tileFor(f, c).refusalLine).toBe('No messages left — nothing was filed.');
    expect(tileFor(f, d).refusalLine).toBeNull();
  });

  it('a refusal under a call that has since RESOLVED is dropped: "deadline has passed" never sits under "Hit at …"', () => {
    const c = call({ state: 'hit', stateChangedAt: T('2026-09-09T15:00:30.000Z') });
    const f = feed([c], { outcomes: { [c.callId]: outcomeFor(c, 409, { error: 'refused', reason: 'expired' }) } });
    expect(tileFor(f, c).tag.text).toBe('Hit at the 11:00 AM check');
    expect(tileFor(f, c).refusalLine).toBeNull();
  });

  it('a refusal under a call that has since been ANSWERED is dropped (the tile shows the answer)', () => {
    const c = call(); c.playerResponse = ack(c);
    const f = feed([c], { outcomes: { [c.callId]: outcomeFor(c, 409, { error: 'refused', reason: 'already_answered' }) } });
    expect(tileFor(f, c).refusalLine).toBeNull();
  });

  it('refusalLineOf is total: no tile or no outcome → null', () => {
    expect(refusalLineOf(null, { status: 409, body: {} })).toBeNull();
    const c = call();
    expect(refusalLineOf(tileFor(feed([c]), c), null)).toBeNull();
  });
});

describe('§8.3 — every refusal row, from a mocked response BODY (R2A-8)', () => {
  const rows = [
    [409, { error: 'refused', reason: 'already_answered' }, "You've already answered this call."],
    [409, { error: 'refused', reason: 'expired' }, "This call's deadline has passed — nothing was filed."],
    [409, { error: 'refused', reason: 'parent_not_active' }, "This battle isn't active — nothing was filed."],
    [409, { error: 'refused', reason: 'belief_mismatch', currentDirectiveThreadId: 't-2' }, "Your agent's instructions changed a moment ago — nothing was filed. Check the tile and try again."],
    [409, { error: 'refused', reason: 'directive_pending', pendingDirectiveThreadId: 't-1' }, "Waiting · your last answer hasn't been heard yet. One call at a time."],
    [409, { error: 'refused', reason: 'budget' }, 'No messages left — nothing was filed.'],
    // 429 — either limiter's body: the per-battle limiter and the security middleware's.
    [429, { error: 'rate_limited' }, 'Too many taps — try again in a minute.'],
    [429, { success: false, error: 'Rate limit exceeded', message: 'Too many requests.', retryAfter: 30 }, 'Too many taps — try again in a minute.'],
    [404, { error: 'cockpit_unavailable' }, 'The cockpit is off for this battle — nothing was filed.'],
    // 400 — any of the endpoint's bodies.
    [400, { error: 'illegal_answer', reason: 'upside_call' }, "That answer isn't available for this call — nothing was filed."],
    [400, { error: 'ineligible_action', reason: 'not_held' }, "That answer isn't available for this call — nothing was filed."],
    [400, { error: 'invalid_request' }, "That answer isn't available for this call — nothing was filed."],
    [400, { error: 'deferred', answer: 'ask' }, "That answer isn't available for this call — nothing was filed."],
    [403, { error: 'forbidden' }, "Only the battle's owner can answer its calls."],
    [401, { error: 'unauthorized' }, 'Sign in again to answer.'],
    [401, null, 'Sign in again to answer.'],
    [500, { error: 'Could not record the answer. Try again in a moment.' }, "Couldn't confirm your answer. Check the tile before trying again."],
    [null, null, "Couldn't confirm your answer. Check the tile before trying again."],
  ];
  it.each(rows)('%s %j → %s', (status, body, line) => {
    expect(cockpitRefusalLine(status, body)).toBe(line);
  });

  it('the last row never says "nothing was filed" (the server may have committed); every 409 / 404 / 400 row does', () => {
    expect(cockpitRefusalLine(500, {})).not.toContain('nothing was filed');
    expect(cockpitRefusalLine(null, null)).not.toContain('nothing was filed');
    expect(cockpitRefusalLine(409, { reason: 'something_new' })).not.toContain('nothing was filed');
    expect(cockpitRefusalLine(404, { error: 'not_found' })).not.toContain('nothing was filed');
  });

  it('the line is read from the BODY: the same status with another reason is another line', () => {
    expect(cockpitRefusalLine(409, { reason: 'budget' })).not.toBe(cockpitRefusalLine(409, { reason: 'expired' }));
    expect(cockpitRefusalLine(404, { error: 'cockpit_unavailable' })).not.toBe(cockpitRefusalLine(404, {}));
  });
});
