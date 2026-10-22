// src/screens/battleView/cockpitModel.2b.test.js
//
// Cockpit Build 2b — THE FROM-MERGE MODEL (spec docs/COCKPIT_BUILD2B_SPEC_V1_0.md
// §7.1, §11 "Client"; contract Amendment D-6, D-8, D-9, D-10, D-12): one card
// per stock plan (D-12 rev 4, the founder's Oct 16 LLY case), coverage and the
// new ask, Following your call (D-10 rev 2, the ZS case), Acted wins on every
// terminal state, the retired / dropped / replaced-by / no-check-left tags —
// all on the FLAG-OFF 2a feed (buildCockpitFeed without v2). Prices render through the shared pinned
// formatter (copy.js fmtPrice → "$1240.00"; the amendment's "$1,240.00" is its prose, not the renderer).

import { describe, it, expect } from 'vitest';
import {
  buildCockpitFeed, foldThreads, commandOf, isFollowing, withinCoverage, callTag, noCheckLeftToday, distinctLevelsOf, COCKPIT_GROUP,
  eventsByCall, sheetOf, receiptLineOf,
} from './cockpitModel';
import { BATTLE_VIEW_COPY as COPY, COCKPIT_FACT_TAGS, COCKPIT_DROPPED_REASON_TEXT } from './battleViewCopy';

const T = (iso) => Date.parse(iso);
/** Fri Oct 16 2026 — the founder's report: back at 1:20 PM ET after 90 minutes. */
const NOW = T('2026-10-16T17:20:00.000Z');
const CLOSE = T('2026-10-16T20:00:00.000Z');
const at = (hhmmEt) => { const [h, m] = hhmmEt.split(':').map(Number); return T(`2026-10-16T${String(h + 4).padStart(2, '0')}:${String(m).padStart(2, '0')}:20.000Z`); };
const iso = (ms) => new Date(ms).toISOString();
const EVALS = ['12:00', '12:45', '13:00', '13:15'].map((t, i) => ({ evalId: `eval_0${20 + i}`, promptBuiltAt: iso(at(t)) }));

let seq = 0;
const call = (over = {}) => {
  seq += 1;
  const minted = over.mintedAt ?? at('12:00') + 40_000;
  return {
    callId: `b:eval_020:call:${seq}`, kind: 'confirmation', battleId: 'b', evalId: 'eval_020', evalSeq: 20, mintedAt: minted, mintedMode: 'on',
    symbol: 'LLY', direction: 'exit', heldAtMint: false, slot: 'core', counterpart: null, counterpartRaw: null,
    condition: { side: 'below', level: 1199.76 }, horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' },
    defaultAction: 'act', said: 'x', saidOk: true, evidence: { tickId: null, availability: 'off', priceAsOf: iso(minted - 40_000) },
    hypothesisRef: null, origin: 'agent_initiative', state: 'open', stateChangedAt: minted, stateSource: 'mint',
    playerResponse: null, directiveThreadId: null, outcome: null, refused: null, replacementOptions: [], invalidatedReason: null,
    ...over,
  };
};
const minted = (hhmm) => ({ mintedAt: at(hhmm) + 40_000, evidence: { tickId: null, availability: 'off', priceAsOf: iso(at(hhmm)) } });
const feed = (calls, over = {}) => buildCockpitFeed({ calls, events: [], evaluations: EVALS, directive: null, nowMs: NOW, nextDecisionAt: iso(at('13:30')), ...over });
const tiles = (f) => [...f.needsYou, ...f.waiting, ...f.earlier];
const cardOf = (f, c) => tiles(f).find((t) => t.calls.some((x) => x.callId === c.callId));
const allStrings = (t) => JSON.stringify([t.line, t.restated, t.lineMoved, t.earlierLevels, t.answerLine, t.commandLine, t.tag?.text, t.eyebrow]);

/** A filed command on `c`, as the endpoint writes it: the call's playerResponse and the battle's slot. */
function command(c, { kind = 'call_hold', answer = 'hold', filedAt = iso(at('13:05')), pickSymbol = null } = {}) {
  const thread = `th-${c.callId}`;
  c.playerResponse = { answer, kind: 'directive', directiveThreadId: thread, callId: c.callId, filedAt, heardEvalId: null };
  c.directiveThreadId = thread;
  return {
    family: 'call', text: 'T', expiry: 'until_ms', expiresAtMs: CLOSE, directiveThreadId: thread, createdAt: filedAt, filedAt,
    callId: c.callId, kind, action: { direction: c.direction, symbol: c.symbol, slot: c.slot, ...(pickSymbol ? { pickSymbol } : {}) }, answerId: `${c.callId}:answer:${answer}:${pickSymbol ?? ''}`,
  };
}
/** The `declared` event of a call's minting check, naming the thread its prompt carried. */
const declared = (c, promptDirectiveThreadId) => ({ kind: 'declared', at: c.mintedAt, callIds: [c.callId], text: 'Called', evidence: { evalId: c.evalId }, ...(promptDirectiveThreadId ? { promptDirectiveThreadId } : {}) });

describe('D-12 — one card per stock plan, at any level (the founder\'s Oct 16 LLY case)', () => {
  const lly1200 = () => call({ ...minted('12:00'), condition: { side: 'below', level: 1199.76 } });
  const lly1300 = () => call({ ...minted('13:00'), condition: { side: 'below', level: 1240 } });
  const lly1315 = () => call({ ...minted('13:15'), condition: { side: 'below', level: 1199.76 } });

  it('two Confirmations 3 % apart fold into ONE card; the newest open level is the headline; "Line moved $A → $B"; the earlier levels, newest first', () => {
    const f = feed([lly1200(), lly1300(), lly1315()]);
    expect(tiles(f)).toHaveLength(1);
    const card = tiles(f)[0];
    expect(card.line).toBe('LLY below $1199.76 by today\'s close');
    expect(card.restated).toBe('Latest line · the 1:15 PM check');
    expect(card.lineMoved).toBe('Line moved $1240.00 → $1199.76');
    expect(card.earlierLevels.map((l) => l.text)).toEqual(['below $1240.00 · from the 1:00 PM check']);
    // Nothing on the card calls it "one call"; the Needs-you count counts cards.
    expect(allStrings(card)).not.toMatch(/one call/i);
    expect(f.needsYouCount).toBe(1);
  });

  it('the buttons answer the NEWEST call', () => {
    const f = feed([lly1200(), lly1300(), lly1315()]);
    const card = tiles(f)[0];
    expect(card.buttons.map((b) => b.answer)).toEqual(['go', 'hold']);
    expect(new Set(card.buttons.map((b) => b.callId))).toEqual(new Set([card.call.callId]));
    expect(card.call.condition.level).toBe(1199.76);
  });

  it('COVERAGE: a call MORE than 1 % from the answered call\'s level is a new ask — its own buttons, Needs you, never "Following your call", the command shown on its own line', () => {
    const answered = lly1300();
    const slot = command(answered);
    const newer = lly1315();
    const f = feed([lly1200(), answered, newer], { directive: slot });
    const card = cardOf(f, answered);
    expect(card.newAsk).toBe(true);
    expect(card.group).toBe(COCKPIT_GROUP.NEEDS_YOU);
    expect(card.buttons.map((b) => b.callId)).toEqual([newer.callId, newer.callId]);
    expect(card.followTag).toBeNull();
    expect(card.commandLine).toBe('Your command · on the $1240.00 line');
    expect(f.needsYouCount).toBe(1);
  });

  it('COVERAGE: a call WITHIN 1 % of the answered level is covered — no buttons, Waiting', () => {
    const answered = lly1300();
    const slot = command(answered);
    const close = call({ ...minted('13:15'), condition: { side: 'below', level: 1235 } });
    const card = cardOf(feed([answered, close], { directive: slot }), answered);
    expect(card.newAsk).toBe(false);
    expect(card.buttons).toEqual([]);
    expect(card.group).toBe(COCKPIT_GROUP.WAITING);
    expect(card.commandLine).toBeNull();
  });

  it('withinCoverage measures against the ANSWERED call\'s level', () => {
    const a = call({ condition: { side: 'below', level: 100 } });
    expect(withinCoverage(a, call({ condition: { side: 'below', level: 101 } }))).toBe(true);
    expect(withinCoverage(a, call({ condition: { side: 'below', level: 101.01 } }))).toBe(false);
    expect(withinCoverage(a, call({ condition: { side: 'below', level: 99 } }))).toBe(true);
  });

  it('an older line that resolves leaves the card for Earlier, under its own tag', () => {
    const old = { ...lly1300(), state: 'expired_unresolved', stateChangedAt: at('13:10') };
    const f = feed([old, lly1315()]);
    expect(f.earlier.map((t) => t.call.callId)).toEqual([old.callId]);
    const card = f.needsYou[0];
    expect(card.calls).toHaveLength(1);
    expect(card.lineMoved).toBeNull();
  });

  it('different plans stay apart: an exit and an entry, two defaults, opposite sides', () => {
    const exit = lly1300();
    expect(foldThreads([exit, call({ ...minted('13:15'), direction: 'entry' })])).toHaveLength(2);
    expect(foldThreads([exit, call({ ...minted('13:15'), defaultAction: 'hold', kind: 'called_shot' })])).toHaveLength(2);
    expect(foldThreads([exit, call({ ...minted('13:15'), condition: { side: 'above', level: 1240 } })])).toHaveLength(2);
  });

  it('distinctLevelsOf: by the shown price, newest first, open calls only', () => {
    const a = lly1300(); const b = lly1315(); const c = call({ ...minted('12:45'), condition: { side: 'below', level: 1240.001 } });
    expect(distinctLevelsOf([b, a, c]).map((l) => l.price)).toEqual(['$1199.76', '$1240.00']);
  });

  it('the moved line renders on the 2a feed too, with no v2 argument (from merge)', () => {
    const card = tiles(buildCockpitFeed({ calls: [lly1300(), lly1315()], events: [], evaluations: EVALS, directive: null, nowMs: NOW }))[0];
    expect(card.lineMoved).toBe('Line moved $1240.00 → $1199.76');
    expect(card.step).toBeNull();
  });
});

describe('D-10 — Following your call (rev 2: the minting check heard the thread)', () => {
  // The ZS case (Oct 9): a hold-default exit answered "go now"; the agent then restates it as an act-default Confirmation.
  const zsShot = () => call({ ...minted('12:45'), symbol: 'ZS', slot: 'support', kind: 'called_shot', defaultAction: 'hold', condition: { side: 'below', level: 228 } });
  const zsConf = (over = {}) => call({ ...minted('13:15'), symbol: 'ZS', slot: 'support', kind: 'confirmation', defaultAction: 'act', condition: { side: 'below', level: 228 }, ...over });

  it('a restatement under the live command joins the answered call\'s card ACROSS defaults, reads "Following your call", and is offered no answer', () => {
    const answered = zsShot();
    const slot = command(answered, { kind: 'call_go', answer: 'go_now', filedAt: iso(at('13:06')) });
    const r = zsConf();
    const f = feed([answered, r], { directive: slot, events: [declared(r, slot.directiveThreadId)] });
    expect(tiles(f)).toHaveLength(1);
    const card = tiles(f)[0];
    expect(card.following).toEqual([r.callId]);
    expect(card.followTag).toEqual({ fact: 'call:following', tone: 'yoursOutline', text: 'Following your call' });
    expect(card.buttons).toEqual([]);
    expect(card.group).toBe(COCKPIT_GROUP.WAITING);
    // The answered call keeps its own tag — never "Following your call" (V5-5).
    expect(card.tag.text).toBe('Filed · not yet heard');
    expect(isFollowing(commandOf({ directive: slot, calls: [answered, r], nowMs: NOW }), answered, { eventsMap: eventsByCall([]) })).toBe(false);
  });

  it('no tag when the minting check\'s declared event is missing or names another thread', () => {
    const answered = zsShot();
    const slot = command(answered, { kind: 'call_go', answer: 'go_now', filedAt: iso(at('13:06')) });
    const r = zsConf();
    for (const events of [[], [declared(r, 'th-other')], [declared(r, null)]]) {
      const f = feed([answered, r], { directive: slot, events });
      expect(tiles(f)).toHaveLength(2);
      expect(tiles(f).every((t) => t.followTag === null)).toBe(true);
    }
  });

  it('every other D-10 test: minted after the filing, the same side, within 1 %, the default asked for, a chosen name respected', () => {
    const answered = zsShot();
    const slot = command(answered, { kind: 'call_go', answer: 'go_now', filedAt: iso(at('13:06')) });
    const cmd = commandOf({ directive: slot, calls: [answered], nowMs: NOW });
    const ok = (r) => isFollowing(cmd, r, { eventsMap: eventsByCall([declared(r, slot.directiveThreadId)]) });
    expect(ok(zsConf())).toBe(true);
    expect(ok(zsConf({ mintedAt: at('13:00') }))).toBe(false); // before the filing
    expect(ok(zsConf({ condition: { side: 'above', level: 228 } }))).toBe(false);
    expect(ok(zsConf({ condition: { side: 'below', level: 225 } }))).toBe(false); // 1.3 %
    // call_go asks for ACT: a hold-default restatement is no D-10 restatement (it folds by plan, D-12, and is covered within 1 %).
    expect(ok(zsConf({ defaultAction: 'hold', kind: 'called_shot' }))).toBe(false);
    expect(isFollowing({ ...cmd, asksDefault: 'act' }, zsConf({ defaultAction: 'hold' }), { eventsMap: eventsByCall([]) })).toBe(false);
    const named = commandOf({ directive: { ...slot, action: { ...slot.action, pickSymbol: 'DHR' } }, calls: [answered], nowMs: NOW });
    const okNamed = (r) => isFollowing(named, r, { eventsMap: eventsByCall([declared(r, slot.directiveThreadId)]) });
    expect(okNamed(zsConf({ counterpart: null }))).toBe(true);
    expect(okNamed(zsConf({ counterpart: 'DHR' }))).toBe(true);
    expect(okNamed(zsConf({ counterpart: 'CEG' }))).toBe(false);
  });

  it('unfolded again when the command stops being live: the restatement is its own card again, answerable', () => {
    const answered = zsShot();
    const slot = command(answered, { kind: 'call_go', answer: 'go_now', filedAt: iso(at('13:06')) });
    const r = zsConf();
    const f = feed([answered, r], { directive: { ...slot, expiresAtMs: NOW - 1 }, events: [declared(r, slot.directiveThreadId)] });
    expect(tiles(f)).toHaveLength(2);
    expect(cardOf(f, r).followTag).toBeNull();
    expect(cardOf(f, r).buttons.length).toBeGreaterThan(0);
  });
});

describe('the new tags (spec §7.1)', () => {
  const tag = (c, events = [], over = {}) => callTag(c, { events, evaluations: EVALS, nowMs: NOW, ...over });

  it('ACTED WINS on every terminal state: hit, expired_unresolved, ended_with_battle — and on an open call', () => {
    for (const state of ['open', 'hit', 'expired_unresolved', 'ended_with_battle']) {
      const c = call({ state, outcome: { actedEvalId: 'eval_022' } });
      expect(tag(c), state).toEqual({ fact: 'event:acted', tone: 'acted', text: 'Acted at the 1:00 PM check' });
    }
    // An invalidated call was never open to an act.
    expect(tag(call({ state: 'invalidated', outcome: { actedEvalId: 'eval_022' } })).fact).toBe('state:invalidated');
  });

  it('Dropped · {reason line} for each D-9 reason; an unknown or absent reason → bare "Dropped"', () => {
    for (const [reason, line] of Object.entries(COCKPIT_DROPPED_REASON_TEXT)) {
      expect(tag(call({ state: 'invalidated', invalidatedReason: reason }))).toEqual({ fact: 'state:invalidated', tone: 'dropped', text: `Dropped · ${line}` });
    }
    expect(COCKPIT_DROPPED_REASON_TEXT).toEqual({ level_implausible: 'price line out of range', level_non_finite: 'no usable price line', no_observation: 'no price at that check' });
    expect(tag(call({ state: 'invalidated', invalidatedReason: 'something_new' })).text).toBe('Dropped');
    expect(tag(call({ state: 'invalidated', invalidatedReason: null })).text).toBe('Dropped');
  });

  it('a retired command: "Command retired · {SYM} left the book at the {t} check", or "· {IN} came in another way"', () => {
    const c = call(); const slot = command(c);
    void slot;
    const left = { kind: 'retired', at: at('13:15') + 30_000, callIds: [c.callId], symbol: 'LLY', reason: 'symbol_not_held', trade: null };
    expect(tag(c, [left])).toEqual({ fact: 'event:retired', tone: 'muted', text: 'Command retired · LLY left the book at the 1:15 PM check' });
    const came = { ...left, symbol: 'DHR', reason: 'pick_already_held' };
    expect(tag(c, [came]).text).toBe('Command retired · DHR came in another way at the 1:15 PM check');
    expect(receiptLineOf(left, c, { evaluations: EVALS, nowMs: NOW })).toBe('Command retired · LLY left the book at the 1:15 PM check');
    expect(COCKPIT_FACT_TAGS['event:retired'].text()).toBe('Command retired');
  });

  it('a newer fact still outranks an older retirement, by its instant', () => {
    const c = call(); command(c);
    c.playerResponse.heardEvalId = 'eval_023';
    const retired = { kind: 'retired', at: at('13:00'), callIds: [c.callId], symbol: 'LLY', reason: 'symbol_not_held' };
    expect(tag(c, [retired]).fact).toBe('event:heard');
  });

  it('Filed · no check left today — the next decision after the session close, or none; a late check (nextDecisionAt withheld) is NOT "no check left"', () => {
    const filedAt = iso(at('13:05'));
    expect(noCheckLeftToday(filedAt, iso(at('13:30')))).toBe(false);
    expect(noCheckLeftToday(filedAt, iso(T('2026-10-19T13:45:00.000Z')))).toBe(true);
    // Review L7 F7: a next decision AT the close (a 3:45:00 check's 4:00:00 PM candidate) is after the session.
    expect(noCheckLeftToday(filedAt, iso(CLOSE))).toBe(true);
    // Withheld (a check running late, or before the first): read from the evaluator schedule.
    expect(noCheckLeftToday(filedAt, null, { nowMs: NOW })).toBe(false);
    expect(noCheckLeftToday(filedAt, null, { nowMs: CLOSE - 60_000 })).toBe(true);
    expect(noCheckLeftToday(filedAt, null, { nowMs: NOW, battleExpiresAtMs: NOW + 60_000 })).toBe(true);
    expect(noCheckLeftToday('not a time', null, { nowMs: NOW })).toBe(false);
    const c = call(); const slot = command(c);
    expect(tag(c, [], { slotThreadId: slot.directiveThreadId, nextDecisionAt: null })).toMatchObject({ fact: 'answer:directive' });
    expect(tag(c, [], { slotThreadId: slot.directiveThreadId, nowMs: CLOSE - 60_000, nextDecisionAt: null })).toEqual({ fact: 'answer:directive_no_check', tone: 'yours', text: 'Filed · no check left today' });
  });
});

describe('the sheet carries the card\'s D-12 lines', () => {
  it('the moved line, the earlier levels, the command\'s own line', () => {
    const a = call({ ...minted('13:00'), condition: { side: 'below', level: 1240 } });
    const slot = command(a);
    const b = call({ ...minted('13:15'), condition: { side: 'below', level: 1199.76 } });
    const card = cardOf(feed([a, b], { directive: slot }), a);
    const sheet = sheetOf(card, { evaluations: EVALS, nowMs: NOW });
    expect(sheet.lineMoved).toBe('Line moved $1240.00 → $1199.76');
    expect(sheet.earlierLevels).toHaveLength(1);
    expect(sheet.commandLine).toBe(COPY.cockpitCommandOnLine('$1240.00'));
  });
});

// ---------------------------------------------------------------------------
// The review's fix round (docs/audits — Build 2b review CB3-*, CB4-5, CB6-4).

describe('review CB3-1 — the command is live while its SLOT is, not while its answered call is open', () => {
  const zsShot = () => call({ ...minted('12:45'), symbol: 'ZS', slot: 'support', kind: 'called_shot', defaultAction: 'hold', condition: { side: 'below', level: 228 } });
  const zsConf = (over = {}) => call({ ...minted('13:15'), symbol: 'ZS', slot: 'support', kind: 'confirmation', defaultAction: 'act', condition: { side: 'below', level: 228 }, ...over });
  it('the answered call HIT under a live slot: its restatement still reads "Following your call" and is offered no answer (flag off and on)', () => {
    const answered = zsShot();
    const slot = command(answered, { kind: 'call_go', answer: 'go_now', filedAt: iso(at('13:06')) });
    answered.state = 'hit';
    answered.stateChangedAt = at('13:15');
    const r = zsConf();
    for (const v2 of [false, true]) {
      const f = feed([answered, r], { directive: slot, events: [declared(r, slot.directiveThreadId)], v2 });
      const card = cardOf(f, r);
      expect(card.following).toEqual([r.callId]);
      expect(card.followTag?.text).toBe('Following your call');
      expect(card.buttons).toEqual([]);
      expect(card.group).toBe(COCKPIT_GROUP.WAITING);
      expect(f.needsYouCount).toBe(0);
      // The answered call itself is in Earlier, as resolved.
      expect(f.earlier.map((t) => t.call.callId)).toContain(answered.callId);
    }
  });
  it('two restatements under a resolved answered call fold onto ONE card of the command', () => {
    const answered = zsShot();
    const slot = command(answered, { kind: 'call_go', answer: 'go_now', filedAt: iso(at('13:06')) });
    answered.state = 'expired_unresolved';
    const r1 = zsConf({ ...minted('13:15') });
    const r2 = zsConf({ ...minted('13:30'), condition: { side: 'below', level: 228.5 } });
    const f = feed([answered, r1, r2], { directive: slot, events: [declared(r1, slot.directiveThreadId), declared(r2, slot.directiveThreadId)] });
    const open = [...f.needsYou, ...f.waiting];
    expect(open).toHaveLength(1);
    expect(open[0].following.sort()).toEqual([r1.callId, r2.callId].sort());
  });
  it('review L7 F1 — the command\'s own key holds its restatement: an unanswered call on the SAME plan stays its own card, with its answers', () => {
    const answered = zsShot();
    const slot = command(answered, { kind: 'call_go', answer: 'go_now', filedAt: iso(at('13:06')) });
    answered.state = 'hit';
    answered.stateChangedAt = at('13:15');
    const before = zsConf({ ...minted('13:01') }); // minted before the command; no declared event names it
    const r = zsConf({ ...minted('13:16') });
    const f = feed([answered, before, r], { directive: slot, events: [declared(r, slot.directiveThreadId)] });
    expect([...f.needsYou, ...f.waiting]).toHaveLength(2);
    expect(cardOf(f, before).buttons.length).toBeGreaterThan(0);
    expect(cardOf(f, r).following).toEqual([r.callId]);
  });
});

describe('review CB3-2 — the retired tag names the check the stock LEFT at (the recorded trade), not the retiring step', () => {
  it('trade at 1:02 PM, retired by the 1:15 PM step → "… left the book at the 1:00 PM check"; no trade → the step\'s check', () => {
    const c = call({ ...minted('12:45') });
    command(c, { kind: 'call_hold', answer: 'hold', filedAt: iso(at('12:50')) });
    const ev = { kind: 'retired', at: at('13:15') + 30_000, callIds: [c.callId], symbol: 'LLY', reason: 'symbol_not_held', trade: { symbolOut: 'LLY', symbolIn: 'MPC', at: iso(T('2026-10-16T17:02:10.000Z')), source: 'archetype' } };
    expect(callTag(c, { events: [ev], evaluations: EVALS, nowMs: NOW }).text).toBe('Command retired · LLY left the book at the 1:00 PM check');
    expect(callTag(c, { events: [{ ...ev, trade: null }], evaluations: EVALS, nowMs: NOW }).text).toBe('Command retired · LLY left the book at the 1:15 PM check');
  });
});

describe('review CB3-3 — after D-4\'s second answer the agreement\'s own receipt reads as the agreement', () => {
  it('ack go 12:05, replace 12:10 → receipts "You agreed · 12:05 PM", "Filed 12:10 PM"', () => {
    const c = call({ ...minted('12:00') });
    const ackAt = T('2026-10-16T16:05:00.000Z');
    const replaceAt = T('2026-10-16T16:10:00.000Z');
    c.playerResponse = { answer: 'replace', kind: 'directive', directiveThreadId: 'th-r', callId: c.callId, filedAt: iso(replaceAt), heardEvalId: null, after: { answer: 'go', filedAt: iso(ackAt) } };
    const events = [
      { kind: 'answered', at: ackAt, callIds: [c.callId], text: '' },
      { kind: 'answered', at: replaceAt, callIds: [c.callId], text: '' },
    ];
    const lines = events.map((e) => receiptLineOf(e, c, { evaluations: EVALS, nowMs: NOW }));
    expect(lines).toEqual(['You agreed · 12:05 PM', 'Filed 12:10 PM']);
  });
});

describe('review CB6-4 — under the flag the answer line quotes the 2b button the player tapped', () => {
  it('go_now reads "exit instead" on an exit, "bring it in" on an entry; 2a keeps "go instead"', () => {
    expect(COPY.cockpitThreadAnswer('go_now', '1:05 PM', '12:00 PM', null, { v2: true, direction: 'exit' })).toBe('You said exit instead · 1:05 PM, on the 12:00 PM wording');
    expect(COPY.cockpitThreadAnswer('go_now', '1:05 PM', null, 'XOM', { v2: true, direction: 'exit' })).toBe('You said exit instead, bring in XOM · 1:05 PM');
    expect(COPY.cockpitThreadAnswer('go_now', '1:05 PM', null, null, { v2: true, direction: 'entry' })).toBe('You said bring it in · 1:05 PM');
    expect(COPY.cockpitThreadAnswer('go_now', '1:05 PM', null)).toBe('You said go instead · 1:05 PM');
  });
});

describe('review CB4-5 — the step keeps the buttons\' gates (deadline, acted)', () => {
  it('past its deadline or once the agent acted, an exit with no counterpart offers no step', () => {
    const exit = (over = {}) => call({ ...minted('12:00'), replacementOptions: [{ symbol: 'XOM', source: 'bench' }], ...over });
    const live = exit();
    expect(cardOf(feed([live], { v2: true }), live).step).toBe('on_card');
    const late = exit({ horizon: { phrase: 'this_session', expiresAt: NOW - 60_000, basis: 'this_session' } });
    expect(cardOf(feed([late], { v2: true }), late).step).toBeNull();
    const acted = exit({ outcome: { actedEvalId: 'eval_022' } });
    expect(cardOf(feed([acted], { v2: true }), acted).step).toBeNull();
  });
});

describe('review (Astra P2) — when the buttons answer a line other than the headline, that line\'s own row sits above them', () => {
  const lly = (hhmm, level) => call({ ...minted(hhmm), condition: { side: 'below', level } });
  const target = (t) => [...new Set(t.buttons.map((b) => b.callId))];

  it('an older unanswered line + a newer answered command: the headline stays the newest line, the row names the older one, and every button answers the older call (flag off and on)', () => {
    const older = lly('12:00', 1199.76);
    const newer = lly('13:00', 1240);
    const slot = command(newer, { kind: 'call_hold', answer: 'hold', filedAt: iso(at('13:05')) });
    for (const v2 of [false, true]) {
      const f = feed([older, newer], { directive: slot, v2 });
      const t = cardOf(f, older);
      expect(cardOf(f, newer), `v2=${v2}`).toBe(t); // one card per stock plan
      expect(t.line).toContain('$1240.00');
      expect(t.lineMoved).toBe('Line moved $1199.76 → $1240.00');
      expect(t.commandLine).toBe('Your command · on the $1240.00 line');
      expect(target(t)).toEqual([older.callId]);
      expect(t.targetLine).toBe('Needs your answer · LLY below $1199.76 · from the 12:00 PM check');
      expect(t.group).toBe(COCKPIT_GROUP.NEEDS_YOU);
    }
  });

  it('a newest restatement within 1 % of the command + an older line more than 1 % away: the buttons answer the older line, never the newest or the answered call', () => {
    const older = lly('12:00', 1199.76);
    const answered = lly('12:45', 1240);
    const slot = command(answered, { kind: 'call_hold', answer: 'hold', filedAt: iso(at('12:50')) });
    const newest = lly('13:15', 1242); // 0.16 % from the answered level: covered, and it follows the command
    for (const v2 of [false, true]) {
      const f = feed([older, answered, newest], { directive: slot, events: [declared(newest, slot.directiveThreadId)], v2 });
      const t = cardOf(f, newest);
      expect(cardOf(f, older), `v2=${v2}`).toBe(t);
      expect(t.line).toContain('$1242.00');
      expect(target(t)).toEqual([older.callId]);
      expect(t.targetLine).toBe('Needs your answer · LLY below $1199.76 · from the 12:00 PM check');
    }
  });

  it('control — no command: the buttons answer the newest line (the headline), and there is no row', () => {
    const older = lly('12:00', 1199.76);
    const newer = lly('13:00', 1240);
    const t = cardOf(feed([older, newer]), newer);
    expect(target(t)).toEqual([newer.callId]);
    expect(t.targetLine).toBeNull();
  });

  it('control — the newest call is the one needing an answer (an older answered command): the buttons answer the headline, and there is no row', () => {
    const older = lly('12:00', 1199.76);
    const slot = command(older, { kind: 'call_hold', answer: 'hold', filedAt: iso(at('12:05')) });
    const newer = lly('13:00', 1240);
    for (const v2 of [false, true]) {
      const t = cardOf(feed([older, newer], { directive: slot, v2 }), newer);
      expect(target(t), `v2=${v2}`).toEqual([newer.callId]);
      expect(t.targetLine).toBeNull();
      expect(t.commandLine).toBe('Your command · on the $1199.76 line');
    }
  });
});
