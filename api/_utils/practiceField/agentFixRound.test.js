// api/_utils/practiceField/agentFixRound.test.js
//
// Practice Field build B2 — THE FIX ROUND for Astra's review (docs/audits/20261123_ASTRA_REVIEW_B2.md), on the in-memory
// harness with a FAKE TRANSPORT (no real model, Firestore or vendor call):
//   B2-A01  a name whose only quote is an earlier session's last trade is no candidate: not offered, and a draft naming it
//           is refused `name_not_a_candidate` — one selector for both (agentSources.js candidatesOf);
//   B2-A02  ruling R-18: `null` on an optional field is omitted; every other wrong type refuses the whole answer; the
//           draft must still be valid on its own (agentTool.js optionalOf);
//   B2-A03  the close row's window-level summary is derived from both desks' parts in the same transaction
//           (agentRun.js agentWindowSummaryOf);
//   B2-A04  a reply whose usage is missing or unreadable is charged its whole reservation (agentRun.js readableUsage);
//   B2-A06  a `price_list` draft carries no thesis label, and every text the close row stores passes the result-word check.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setPracticeFieldModeForTests, setPracticeFieldAgentForTests } from './mode.js';
import { admitIdea } from './admission.js';
import { runDeskCheck, runIdeaBookAgentPass, agentWindowSummaryOf, readableUsage } from './agentRun.js';
import { validateAgentAnswer } from './agentTool.js';
import { candidatesOf } from './agentSources.js';
import { CODE_FALLBACK_NOTE } from './agentConfig.js';
import { seedBook, getBook, getIdea, etIso, DAYS, closeOn, windowAt, closeSnapshot } from './__testsupport__/fixtures.js';
import {
  quotesOn, foundersMediumIdea, fakeTransport, toolResponse, holdAll, draft, deskPartsOf, agentNowOf, sectionOf,
} from './__testsupport__/agentFixtures.js';

let restoreMode;
let restoreAgent;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('on');
  restoreAgent = setPracticeFieldAgentForTests({ agent: true, theses: false });
});
afterEach(() => { restoreAgent(); restoreMode(); });

const D1 = DAYS.d1; // Mon 16 Nov 2026

/** The founder's book: created Friday 13 Nov, the medium idea admitted that day, entered Monday at its first window. */
async function foundersBook() {
  const ctx = await seedBook({ nowIso: etIso(DAYS.admit, 9, 0) });
  const admitted = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: foundersMediumIdea(), opId: 'founder-medium', nowIso: etIso(DAYS.admit, 11, 0) });
  expect(admitted.ok).toBe(true);
  return { ...ctx, mediumId: admitted.ideaId };
}

/** Day 1 up to (not including) the agent: three windows and the close. */
async function windowsAndClose(ctx, date, quotes = quotesOn()) {
  for (const slot of ['open30', 'midday', 'preClose']) await windowAt(ctx.db, ctx.bookId, { date, slot, quotes });
  const close = await closeOn(ctx.db, ctx.bookId, date, quotes);
  expect(close.closed).toBe(true);
}

/** The Shadow desk's check at D1 with a scripted answer. */
async function shadowAt(ctx, script) {
  const fake = fakeTransport(script);
  const res = await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) });
  return { res, fake, part: deskPartsOf(ctx.db, ctx.bookId, D1).shadow, row: ctx.db._get(`mandates/${ctx.bookId}/windows/${D1}_close`) };
}

/** What nothing-changed means: the book's money and its ideas, byte for byte. */
const moneyOf = (ctx) => {
  const book = getBook(ctx.db, ctx.bookId);
  return JSON.stringify([book.treasury, book.portfolio, book.slots, book.openIdeaIds, ...book.openIdeaIds.map((id) => getIdea(ctx.db, ctx.bookId, id))]);
};

/** The candidate names a request carried (its `## Candidates` section). */
const offeredNames = (request) => sectionOf(request, 'Candidates').map((l) => l.split(' ')[0]);

describe('B2-A01: an earlier session\'s last trade is no candidate — one selector for the prompt and for drafting', () => {
  // Astra's failing test, as she wrote it: MSFT's only quote is Friday 13 Nov's 16:00 last trade, correctly timed.
  const fridaysMsft = { ...quotesOn(), MSFT: { price: 420, at: etIso(DAYS.admit, 16, 0) } };

  it('MSFT quoted at Friday\'s close: absent from the prompt; a draft naming it is refused name_not_a_candidate; the treasury and the long slot unchanged', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1, fridaysMsft);
    const before = getBook(ctx.db, ctx.bookId);
    const { fake, part } = await shadowAt(ctx, ({ request }) => toolResponse(holdAll(request, { drafts: [draft({ slot: 'long', names: ['MSFT'] })] })));
    expect(fake.calls).toHaveLength(1);
    const offered = offeredNames(fake.calls[0].request);
    expect(offered.length).toBeGreaterThan(5);
    expect(offered).not.toContain('MSFT');
    expect(part.considered.map((c) => [c.outcome, c.refusals.map((r) => [r.code, r.symbol])])).toEqual([['refused', [['name_not_a_candidate', 'MSFT']]]]);
    const after = getBook(ctx.db, ctx.bookId);
    expect(after.treasury).toEqual(before.treasury);
    expect(after.slots.long).toBeNull();
    expect(after.openIdeaIds).toEqual(before.openIdeaIds);
  });

  it('positive control: MSFT quoted at THIS session\'s close is offered and admitted', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const { fake, part } = await shadowAt(ctx, ({ request }) => toolResponse(holdAll(request, { drafts: [draft({ slot: 'long', names: ['MSFT'] })] })));
    expect(offeredNames(fake.calls[0].request)).toContain('MSFT');
    expect(part.considered.map((c) => c.outcome)).toEqual(['admitted']);
    expect(getBook(ctx.db, ctx.bookId).slots.long).toBe(part.considered[0].ideaId);
  });

  it('the selector, pure: only a mark the book\'s own classifier reads as THIS session\'s close (vendor_time) is a candidate', () => {
    const snap = closeSnapshot(D1, {
      ...quotesOn(),
      MSFT: { price: 420, at: etIso(DAYS.admit, 16, 0) }, // carried_forward: an earlier session's last trade
      AAPL: { price: 230, at: etIso(D1, 8, 0) }, // pre_open_print: before this session's open
      NVDA: { price: 140, at: null }, // receipt_time_fallback: no vendor time, cannot show its session
    });
    const names = candidatesOf(snap, new Set(), { session: D1 }).map((c) => c.symbol);
    for (const s of ['MSFT', 'AAPL', 'NVDA']) expect(names, s).not.toContain(s);
    expect(names).toContain('AMZN'); // control: a quote at this session's close
    expect(candidatesOf(snap, new Set(), { session: DAYS.d2 })).toEqual([]); // a snapshot of another session
    expect(candidatesOf(snap, new Set())).toEqual([]); // no session: nothing is certified
  });
});

describe('B2-A02 — ruling R-18: null on an optional field means omitted; every other wrong type refuses the whole answer', () => {
  /** The exit of the founder's medium idea, beside one long draft. */
  const exitPlus = (request, d) => ({
    ...holdAll(request), actions: [{ ideaId: holdAll(request).actions[0].ideaId, action: 'exit', reason: 'The banks have had their run.' }], drafts: [d],
  });

  it('the exit plus a same_stock_held draft with symbols: null is ACCEPTED (R-18): the exit settles and the draft is admitted', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const { res, part } = await shadowAt(ctx, ({ request }) => toolResponse(exitPlus(request, draft({ slot: 'long', names: ['MSFT'], comparison: { type: 'same_stock_held', symbols: null } }))));
    expect(res).toMatchObject({ source: 'model' });
    expect(part.actions).toMatchObject([{ ideaId: ctx.mediumId, action: 'exit', outcome: 'exit_settled' }]);
    expect(part.considered.map((c) => c.outcome)).toEqual(['admitted']);
    expect(part.answer.drafts[0].comparison).toEqual({ type: 'same_stock_held' }); // null read as omitted
    expect(getIdea(ctx.db, ctx.bookId, ctx.mediumId).managerExit).toBeTruthy();
  });

  const refusedWhole = [
    ['symbols: "MSFT" (a string where an array belongs)', { comparison: { type: 'same_stock_held', symbols: 'MSFT' } }, 'drafts[0].comparison.symbols:invalid'],
    ['symbols: [1] (an array of the wrong element type)', { comparison: { type: 'same_stock_held', symbols: [1] } }, 'drafts[0].comparison.symbols:invalid'],
    ['thesisRef: 7 (a number where a string belongs)', { source: { kind: 'saved_thesis', thesisRef: 7 } }, 'drafts[0].source.thesisRef:invalid'],
    ['thesisRef: ["T1"] on a price_list draft (checked for its type before it is dropped)', { source: { kind: 'price_list', thesisRef: ['T1'] } }, 'drafts[0].source.thesisRef:invalid'],
  ];
  for (const [name, over, reason] of refusedWhole) {
    it(`${name}: refused WHOLE — one charged call, code_fallback, no exit, no admission`, async () => {
      const ctx = await foundersBook();
      await windowsAndClose(ctx, D1);
      const before = moneyOf(ctx);
      const { res, fake, part } = await shadowAt(ctx, ({ request }) => toolResponse(exitPlus(request, { ...draft({ slot: 'long', names: ['MSFT'] }), ...over })));
      expect(fake.calls).toHaveLength(1);
      expect(res).toMatchObject({ source: 'code_fallback', reason: `answer_invalid:${reason}` });
      expect(part).toMatchObject({ source: 'code_fallback', note: CODE_FALLBACK_NOTE, actions: [], considered: [] });
      expect(part.attempts).toMatchObject([{ outcome: 'invalid_answer', unpriced: false, chargedUsd: 0.03 }]);
      expect(getIdea(ctx.db, ctx.bookId, ctx.mediumId).managerExit).toBeUndefined(); // no manager endpoint
      expect(moneyOf(ctx)).toBe(before); // no exit, no admission: the same portfolio
    });
  }

  it('a sector_fund draft with symbols: null is refused AS THAT DRAFT (no fund) and listed as considered; the valid exit beside it stands', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const { res, part } = await shadowAt(ctx, ({ request }) => toolResponse(exitPlus(request, draft({ slot: 'long', names: ['MSFT'], comparison: { type: 'sector_fund', symbols: null } }))));
    expect(res).toMatchObject({ source: 'model' });
    expect(part.actions).toMatchObject([{ action: 'exit', outcome: 'exit_settled' }]);
    expect(part.considered).toHaveLength(1);
    expect(part.considered[0]).toMatchObject({ outcome: 'refused', comparison: { type: 'sector_fund' } });
    expect(part.considered[0].refusals.map((r) => r.code)).toContain('comparison_fund_unknown');
    expect(getBook(ctx.db, ctx.bookId).slots.long).toBeNull();
    expect(getIdea(ctx.db, ctx.bookId, ctx.mediumId).managerExit).toBeTruthy();
  });

  it('a saved_thesis draft with thesisRef: null is refused AS THAT DRAFT (thesis_source_unknown); the valid exit beside it stands', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const { res, part } = await shadowAt(ctx, ({ request }) => toolResponse(exitPlus(request, draft({ slot: 'long', names: ['MSFT'], source: { kind: 'saved_thesis', thesisRef: null } }))));
    expect(res).toMatchObject({ source: 'model' });
    expect(part.actions).toMatchObject([{ action: 'exit', outcome: 'exit_settled' }]);
    expect(part.considered.map((c) => [c.outcome, c.refusals.map((r) => r.code)])).toEqual([['refused', ['thesis_source_unknown']]]);
  });

  it('a price_list draft with thesisRef: null is accepted and admitted (R-18)', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const { part } = await shadowAt(ctx, ({ request }) => toolResponse(holdAll(request, { drafts: [draft({ slot: 'long', names: ['MSFT'], source: { kind: 'price_list', thesisRef: null } })] })));
    expect(part.considered.map((c) => c.outcome)).toEqual(['admitted']);
  });

  it('the validator, pure: R-18 over both optional fields — null and absent are the same answer; every other wrong type is refused whole', () => {
    const base = { slot: 'long', thesis: 'MSFT should outrun its comparison.', names: ['MSFT'], comparison: { type: 'same_stock_held' }, lines: [{ symbol: 'MSFT', distancePct: 0.15 }], source: { kind: 'price_list' } };
    const check = (d) => validateAgentAnswer({ bookNote: 'A note.', actions: [], drafts: [d] }, { openIdeaIds: [] });
    const absent = check(base);
    expect(absent.ok).toBe(true);
    expect(check({ ...base, comparison: { type: 'same_stock_held', symbols: null } })).toEqual(absent);
    expect(check({ ...base, source: { kind: 'price_list', thesisRef: null } })).toEqual(absent);
    const rows = [
      [{ comparison: { type: 'same_stock_held', symbols: 'MSFT' } }, 'drafts[0].comparison.symbols:invalid'],
      [{ comparison: { type: 'same_stock_held', symbols: [1] } }, 'drafts[0].comparison.symbols:invalid'],
      [{ comparison: { type: 'same_stock_held', symbols: {} } }, 'drafts[0].comparison.symbols:invalid'],
      [{ comparison: { type: 'same_stock_held', symbols: false } }, 'drafts[0].comparison.symbols:invalid'],
      [{ source: { kind: 'saved_thesis', thesisRef: 7 } }, 'drafts[0].source.thesisRef:invalid'],
      [{ source: { kind: 'saved_thesis', thesisRef: '' } }, 'drafts[0].source.thesisRef:invalid'],
      [{ source: { kind: 'price_list', thesisRef: false } }, 'drafts[0].source.thesisRef:invalid'],
    ];
    for (const [over, reason] of rows) expect(check({ ...base, ...over }), reason).toEqual({ ok: false, reason });
  });
});

describe('B2-A03: the close row\'s window-level summary follows both desks\' recorded work', () => {
  it('a hold plus an admission: the row records the call and the admission; the other desk finishing with no work, and a replay, keep the counts', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const rowOf = () => ctx.db._get(`mandates/${ctx.bookId}/windows/${D1}_close`);
    expect(rowOf()).toMatchObject({ modelCalled: false, outcome: 'no_model_action' }); // the close's own row, before the agent
    const { part } = await shadowAt(ctx, ({ request }) => toolResponse(holdAll(request, { drafts: [draft({ slot: 'long', names: ['MSFT'] })] })));
    expect(part.actions.map((a) => a.outcome)).toEqual(['held']);
    expect(part.considered.map((c) => c.outcome)).toEqual(['admitted']);
    expect(rowOf()).toMatchObject({
      modelCalled: true, outcome: 'model_action',
      agent: { summary: { calls: { shadow: 1 }, callsTotal: 1, exits: 0, admissions: 1, paidFallbacks: [], codeActed: false } },
    });
    // The archetype desk then finishes with NO work (its one slot is taken): it records none, and the Shadow desk's stands.
    const book = getBook(ctx.db, ctx.bookId);
    ctx.db._store.set(`mandates/${ctx.bookId}`, { data: { ...book, slots: { ...book.slots, short: 'idea_placeholder_for_this_row' } }, version: 98 });
    const fake = fakeTransport(({ request }) => toolResponse(holdAll(request)));
    const arch = await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'archetype', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(arch).toMatchObject({ source: 'no_work', calls: 0 });
    expect(fake.calls).toEqual([]);
    expect(rowOf()).toMatchObject({ modelCalled: true, outcome: 'model_action', agent: { summary: { calls: { shadow: 1, archetype: 0 }, callsTotal: 1, admissions: 1 } } });
    ctx.db._store.set(`mandates/${ctx.bookId}`, { data: book, version: 99 });
    // A replay of the whole pass: no call, and the row byte for byte.
    const bytes = JSON.stringify(rowOf());
    const again = await runIdeaBookAgentPass(ctx.db, { date: D1, now: agentNowOf(D1), ownerToken: 't2', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(again.calls).toBe(0);
    expect(JSON.stringify(rowOf())).toBe(bytes);
  });

  it('the other desk answering too: both calls counted, the admission kept; a replay changes nothing', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const fake = fakeTransport(({ request, desk }) => toolResponse(holdAll(request, { drafts: desk === 'shadow' ? [draft({ slot: 'long', names: ['MSFT'] })] : [] })));
    await runIdeaBookAgentPass(ctx.db, { date: D1, now: agentNowOf(D1), ownerToken: 't1', transport: fake.transport, clock: () => agentNowOf(D1) });
    const row = ctx.db._get(`mandates/${ctx.bookId}/windows/${D1}_close`);
    expect(row).toMatchObject({ modelCalled: true, outcome: 'model_action', agent: { summary: { calls: { shadow: 1, archetype: 1 }, callsTotal: 2, admissions: 1, exits: 0 } } });
    const bytes = JSON.stringify(row);
    await runIdeaBookAgentPass(ctx.db, { date: D1, now: agentNowOf(D1), ownerToken: 't2', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(fake.calls).toHaveLength(2);
    expect(JSON.stringify(ctx.db._get(`mandates/${ctx.bookId}/windows/${D1}_close`))).toBe(bytes);
  });

  it('a PAID FALLBACK reads apart from an executed proposal: model_fallback, the call counted, nothing executed', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const { row } = await shadowAt(ctx, ({ request }) => toolResponse({ ...holdAll(request), bookNote: 'n'.repeat(601) }));
    expect(row).toMatchObject({ modelCalled: true, outcome: 'model_fallback', agent: { summary: { calls: { shadow: 1 }, exits: 0, admissions: 0, paidFallbacks: ['shadow'] } } });
  });

  it('a held answer with nothing executed: model_no_change', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const { row } = await shadowAt(ctx, ({ request }) => toolResponse(holdAll(request)));
    expect(row).toMatchObject({ modelCalled: true, outcome: 'model_no_change', agent: { summary: { calls: { shadow: 1 }, exits: 0, admissions: 0, paidFallbacks: [] } } });
  });

  it('paused control: neither desk calls; the row records zero calls and no model action', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const book = getBook(ctx.db, ctx.bookId);
    ctx.db._store.set(`mandates/${ctx.bookId}`, { data: { ...book, drafting: 'paused' }, version: 99 });
    const fake = fakeTransport(({ request }) => toolResponse(holdAll(request)));
    await runIdeaBookAgentPass(ctx.db, { date: D1, now: agentNowOf(D1), ownerToken: 't', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(fake.calls).toEqual([]);
    expect(ctx.db._get(`mandates/${ctx.bookId}/windows/${D1}_close`)).toMatchObject({
      modelCalled: false, outcome: 'no_model_action', agent: { summary: { calls: { shadow: 0, archetype: 0 }, callsTotal: 0, exits: 0, admissions: 0, paidFallbacks: [] } },
    });
  });

  it('the summary, pure: every combination of code acting and each desk\'s source and executed work', () => {
    const acted = { endpoints: [], ideasResulted: ['i9'], entriesTimedOut: [], bookClosed: false };
    const still = { endpoints: [], ideasResulted: [], entriesTimedOut: [], bookClosed: false };
    const part = {
      none: undefined,
      noWork: { source: 'no_work', calledModel: false, attempts: [], actions: [], considered: [] },
      held: { source: 'model', calledModel: true, attempts: [{}], actions: [{ outcome: 'held' }], considered: [{ outcome: 'refused' }] },
      exited: { source: 'model', calledModel: true, attempts: [{}], actions: [{ outcome: 'exit_settled' }], considered: [] },
      admitted: { source: 'model', calledModel: true, attempts: [{}, {}], actions: [], considered: [{ outcome: 'admitted' }, { outcome: 'not_chosen' }] },
      paidFallback: { source: 'code_fallback', calledModel: true, attempts: [{}], actions: [], considered: [] },
      freeFallback: { source: 'code_fallback', calledModel: false, attempts: [], actions: [], considered: [] },
      inProgress: { status: 'in_progress', calledModel: true, attempts: [{ state: 'reserved' }] },
    };
    const want = (code, a, b) => {
      const ps = [part[a], part[b]].filter(Boolean);
      const executed = ps.some((p) => p.source === 'model' && (p.actions.some((x) => x.outcome === 'exit_settled') || p.considered.some((x) => x.outcome === 'admitted')));
      if (executed) return 'model_action';
      if (ps.some((p) => p.source === 'code_fallback' && p.attempts.length > 0)) return 'model_fallback';
      if (code === acted) return 'code_action';
      if (ps.some((p) => p.calledModel)) return 'model_no_change';
      return 'no_model_action';
    };
    let n = 0;
    for (const code of [still, acted]) {
      for (const a of Object.keys(part)) {
        for (const b of Object.keys(part)) {
          const desks = { ...(part[a] ? { shadow: part[a] } : {}), ...(part[b] ? { archetype: part[b] } : {}) };
          const s = agentWindowSummaryOf({ code }, desks);
          const label = `${code === acted ? 'code acted' : 'code still'} · shadow ${a} · archetype ${b}`;
          expect(s.outcome, label).toBe(want(code, a, b));
          expect(s.modelCalled, label).toBe([part[a], part[b]].some((p) => p?.calledModel === true));
          expect(s.summary.callsTotal, label).toBe((part[a]?.attempts?.length ?? 0) + (part[b]?.attempts?.length ?? 0));
          expect(s.summary.codeActed, label).toBe(code === acted);
          n += 1;
        }
      }
    }
    expect(n).toBe(2 * 8 * 8);
    // A row with no code block (the window cursor's) reads code still.
    expect(agentWindowSummaryOf(null, {}).outcome).toBe('no_model_action');
  });
});

describe('B2-A04: a reply whose usage is missing or unreadable is charged its whole reservation, never $0', () => {
  const unreadable = [
    ['usage: {}', {}],
    ['no usage at all', undefined],
    ['counts as strings', { input_tokens: '6000', output_tokens: '1800' }],
    ['a negative count', { input_tokens: 6000, output_tokens: -1 }],
    ['zero input', { input_tokens: 0, output_tokens: 1800 }],
    ['a fractional cache count', { input_tokens: 6000, output_tokens: 1800, cache_read_input_tokens: 0.5 }],
  ];
  for (const [name, usage] of unreadable) {
    it(`${name}: unpriced, charged the reservation; the answer still acted on`, async () => {
      const ctx = await foundersBook();
      await windowsAndClose(ctx, D1);
      const { res, part } = await shadowAt(ctx, ({ request }) => ({ ...toolResponse(holdAll(request)), usage }));
      expect(res).toMatchObject({ source: 'model' });
      expect(part.attempts).toMatchObject([{ outcome: 'answered', unpriced: true, usage: null, usageUnreadable: true, chargedUsd: 0.1625 }]);
      expect(getBook(ctx.db, ctx.bookId).spend).toMatchObject({ reservedUsd: 0.1625, settledUsd: 0.1625 });
    });
  }

  it('readableUsage, pure: the fixture\'s usage reads; cache counts may be absent or null', () => {
    expect(readableUsage({ input_tokens: 6000, output_tokens: 1800, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 })).toBe(true);
    expect(readableUsage({ input_tokens: 6000, output_tokens: 0 })).toBe(true);
    expect(readableUsage({ input_tokens: 6000, output_tokens: 1800, cache_read_input_tokens: null })).toBe(true);
    for (const [, u] of unreadable) expect(readableUsage(u)).toBe(false);
    expect(readableUsage([6000, 1800])).toBe(false);
  });
});

describe('B2-A06: a price_list draft carries no thesis label; every text the row stores passes the result-word check', () => {
  it('a price_list draft carrying thesisRef "proven" is admitted, and the whole close row holds no result word', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const { part, row } = await shadowAt(ctx, ({ request }) => toolResponse(holdAll(request, { drafts: [draft({ slot: 'long', names: ['MSFT'], source: { kind: 'price_list', thesisRef: 'proven' } })] })));
    expect(part.considered.map((c) => c.outcome)).toEqual(['admitted']);
    expect(part.considered[0].source).toEqual({ kind: 'price_list', thesisRef: null });
    expect(part.answer.drafts[0].source).toEqual({ kind: 'price_list', thesisRef: null });
    expect(JSON.stringify(row)).not.toMatch(/proven/i);
  });

  it('the validator, pure: a result word in a kept label, a name, a comparison symbol or a line symbol refuses the whole answer', () => {
    const base = { slot: 'long', thesis: 'MSFT should outrun its comparison.', names: ['MSFT'], comparison: { type: 'same_stock_held' }, lines: [{ symbol: 'MSFT', distancePct: 0.15 }], source: { kind: 'price_list' } };
    const check = (d) => validateAgentAnswer({ bookNote: 'A note.', actions: [], drafts: [d] }, { openIdeaIds: [] });
    const rows = [
      [{ source: { kind: 'saved_thesis', thesisRef: 'proven' } }, 'drafts[0].source.thesisRef:banned_word'],
      [{ names: ['PROVEN'], lines: [{ symbol: 'MSFT', distancePct: 0.15 }] }, 'drafts[0].names:banned_word'],
      [{ comparison: { type: 'frozen_basket', symbols: ['AAPL', 'Validated'] } }, 'drafts[0].comparison.symbols:banned_word'],
      [{ lines: [{ symbol: 'supported', distancePct: 0.15 }] }, 'drafts[0].lines:banned_word'],
    ];
    for (const [over, reason] of rows) expect(check({ ...base, ...over }), reason).toEqual({ ok: false, reason });
    // Controls: the same shapes with plain text are accepted; a saved_thesis label is kept.
    expect(check({ ...base, source: { kind: 'saved_thesis', thesisRef: 'T1' } })).toMatchObject({ ok: true, answer: { drafts: [{ source: { kind: 'saved_thesis', thesisRef: 'T1' } }] } });
    expect(check({ ...base, comparison: { type: 'frozen_basket', symbols: ['AAPL', 'AMZN'] } }).ok).toBe(true);
  });
});
