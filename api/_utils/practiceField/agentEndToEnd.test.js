// api/_utils/practiceField/agentEndToEnd.test.js
//
// Practice Field build B2 — THE AGENT, END TO END on the in-memory harness, with a FAKE TRANSPORT (no real model,
// Firestore or vendor call). Thirteen sessions, 16 Nov to 3 Dec 2026 — the 27 Nov early close among them — of the
// founder's own book: his hand-entered medium idea (JPM, BAC and GS against XLF) and two empty slots.
//
//   • at each close both desks check the book: the Shadow desk (medium, long) and the archetype desk (short);
//   • the Shadow desk drafts its empty long slot and the archetype desk its short one; code sizes them, admits them at
//     the close's snapshot, and they enter at the next session's first window;
//   • on 20 Nov the archetype desk EXITS its short idea: the endpoint is that close's, the settlement sale fills at the
//     next session's first window (23 Nov), the idea is resulted, and the desk drafts the slot again at that close;
//   • notes are written at every close, each under its desk's name; the spend stays under B9 ($3 a month);
//   • THE REFUSAL PATHS AND THE CODE FALLBACK inside the run: on day 1 the archetype desk's first draft is outside the
//     rails (refused, on the considered list) and its second is admitted; on 24 Nov the Shadow desk's call fails twice
//     (two timeouts: the code-built note, nothing changed) and the next session runs normally; 27 Nov closes early;
//   • the same history with the saved theses' sub-switch on — the Shadow desk drafts from the owner's saved thesis
//     (origin `research`, the saved list as its source) — and with it off (the price list, origin `market_scan`).
// The book is reconciled after every session and the final store is dumped and pinned.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { setPracticeFieldModeForTests } from './mode.js';
import { verifyPacket, resultPacketPartProblems, recomputeResultFromPacket } from './evidence.js';
import { MONTHLY_SPEND_BOUND_USD } from './spend.js';
import { CODE_FALLBACK_NOTE } from './agentConfig.js';
import { getBook, getIdea, DAYS, dumpStore, bannedWordsOnResults } from './__testsupport__/fixtures.js';
import { deskPartsOf } from './__testsupport__/agentFixtures.js';
import { runFoundersBook, EARLY_CLOSE, EXIT_SESSION, FAIL_SESSION } from './__testsupport__/agentEndToEndRun.js';

let restoreMode;
let restoreAgent;
let errSpy;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('on');
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { restoreAgent?.(); restoreMode(); errSpy.mockRestore(); });

// Build B4: the run itself (sessions, the saved thesis, the scripted desks, the run) lives in
// __testsupport__/agentEndToEndRun.js, moved there unchanged, so the founder's-live-book proof runs the same run.
const runBook = ({ theses }) => runFoundersBook({ theses, onRestore: (r) => { restoreAgent = r; } });

const ideasOf = (ctx) => [...ctx.db._store.keys()].filter((p) => new RegExp(`^mandates/${ctx.bookId}/ideas/[^/]+$`).test(p)).map((p) => ctx.db._get(p));

describe('the agent end to end — thirteen sessions of the founder\'s book (saved theses off)', () => {
  it('drafts at the close, enters at the next window, notes every close, exits early through the settlement sale, stays under B9', { timeout: 60_000 }, async () => {
    const { ctx, fake, days, results, mediumId } = await runBook({ theses: false });
    expect(days).toHaveLength(13);
    expect(days).toContain(EARLY_CLOSE);
    // Every close: both desks checked, a note under each name — from the model, but on FAIL_SESSION, where the Shadow desk's
    // two attempts timed out and its note is code's.
    for (const { date, agent } of results) {
      const parts = deskPartsOf(ctx.db, ctx.bookId, date);
      expect(parts.archetype, date).toMatchObject({ deskName: 'The archetype desk', source: 'model', note: `Archetype desk, ${date}: short-term only.` });
      if (date === FAIL_SESSION) {
        expect(agent, date).toMatchObject({ books: 1, checked: 1, calls: 3, fallbacks: 1, errors: 0 });
        expect(parts.shadow).toMatchObject({ deskName: 'The Shadow desk', source: 'code_fallback', note: CODE_FALLBACK_NOTE, fallbackReason: 'transport_failed', actions: [], considered: [] });
        expect(parts.shadow.attempts.map((a) => [a.outcome, a.unpriced])).toEqual([['transport_error', true], ['transport_error', true]]);
        continue;
      }
      expect(agent, date).toMatchObject({ books: 1, checked: 1, calls: 2, fallbacks: 0, errors: 0 });
      expect(parts.shadow, date).toMatchObject({ deskName: 'The Shadow desk', source: 'model', note: `Shadow desk, ${date}: the banks hold their line against XLF.` });
    }
    expect(fake.calls).toHaveLength(27);
    // The session after the fallback ran normally, and the fallback changed nothing: the medium idea still held.
    expect(deskPartsOf(ctx.db, ctx.bookId, '2026-11-25').shadow).toMatchObject({ source: 'model' });
    // Day 1's refused draft is on the considered list with its code; the next one was admitted.
    expect(deskPartsOf(ctx.db, ctx.bookId, days[0]).archetype.considered.map((c) => [c.index, c.outcome, c.refusals.map((r) => r.code)]))
      .toEqual([[0, 'refused', ['line_distance_out_of_band']], [1, 'admitted', []]]);

    // Day 1's drafts were admitted at its close and entered at day 2's first window.
    const ideas = ideasOf(ctx);
    const long = ideas.find((i) => i.contract.slot === 'long');
    expect(long.contract).toMatchObject({ desk: 'shadow', names: ['MSFT', 'NVDA'], origin: { kind: 'market_scan' }, sources: [{ kind: 'market_scan', ref: `${days[0]}_close` }] });
    expect(long.entry).toMatchObject({ sessionDate: days[1], slot: 'open30' });
    expect(long.status).toBe('holding');

    // The archetype desk's first short idea: drafted day 1, entered day 2, EXITED at the 20 Nov close — endpoint that
    // close, settlement sale at 23 Nov's first window, resulted; the desk drafted the short slot again at that close.
    const shorts = ideas.filter((i) => i.contract.slot === 'short').sort((a, b) => (a.admittedAt < b.admittedAt ? -1 : 1));
    expect(shorts.length).toBe(2);
    const [exited, refill] = shorts;
    expect(exited.contract).toMatchObject({ desk: 'archetype', names: ['XOM'] });
    expect(exited.entry.sessionDate).toBe(days[1]);
    expect(exited.status).toBe('resulted');
    expect(exited.endpoint).toMatchObject({ session: EXIT_SESSION, kind: 'manager_exit' });
    expect(exited.result).toMatchObject({ endpointKind: 'manager_exit', endpointSession: EXIT_SESSION, managerExit: { session: EXIT_SESSION, desk: 'archetype', reason: 'The breakout failed; the setup no longer holds.' } });
    expect(exited.managerExit).toMatchObject({ session: EXIT_SESSION, desk: 'archetype' });
    const sale = exited.ledger.saleReceipts.find((r) => r.symbol === 'XOM');
    expect(sale).toMatchObject({ kind: 'settlement', sessionDate: '2026-11-23', tickKey: '2026-11-23_open30', queuedBy: { session: EXIT_SESSION, reason: 'manager_exit' } });
    expect(deskPartsOf(ctx.db, ctx.bookId, EXIT_SESSION).archetype.actions).toEqual([{ ideaId: exited.ideaId, action: 'exit', reason: 'The breakout failed; the setup no longer holds.', outcome: 'exit_settled' }]);
    expect(refill.contract).toMatchObject({ desk: 'archetype', names: ['CVX'] });
    expect(refill.admittedAt.slice(0, 10)).toBe('2026-11-23');
    expect(refill.entry.sessionDate).toBe('2026-11-24');

    // THE RESULT READER CHECKS THE PARTS (carried condition): the exited idea's packet is whole — its own hash AND its
    // receipt parts — and recomputes to the result it carries.
    const ideaPath = `mandates/${ctx.bookId}/ideas/${exited.ideaId}`;
    const packet = ctx.db._get(`${ideaPath}/evidence/result`);
    const parts = Object.fromEntries([...ctx.db._store.keys()].filter((p) => p.startsWith(`${ideaPath}/evidence/result_actions_`)).map((p) => [p.split('/').pop(), ctx.db._get(p)]));
    expect(verifyPacket(packet)).toBe(true);
    expect(resultPacketPartProblems(packet, parts)).toEqual([]);
    expect(recomputeResultFromPacket(packet).problems).toEqual([]);
    expect(packet.endpoint).toMatchObject({ session: EXIT_SESSION, kind: 'manager_exit' });

    // The founder's medium idea: the Shadow desk's, held at every close, untouched by the archetype desk.
    expect(getIdea(ctx.db, ctx.bookId, mediumId).status).toBe('holding');
    for (const { date } of results.filter((r) => r.date !== FAIL_SESSION)) expect(deskPartsOf(ctx.db, ctx.bookId, date).shadow.actions.map((x) => [x.ideaId, x.outcome])).toContainEqual([mediumId, 'held']);

    // THE EARLY-CLOSE SESSION (27 Nov, carried condition): its windows were served at the early-close geometry, its close
    // ran, and both desks checked the book after it, like any other session.
    const earlyRow = ctx.db._get(`mandates/${ctx.bookId}/windows/${EARLY_CLOSE}_close`);
    expect(earlyRow.session).toMatchObject({ expected: ['open30', 'midday', 'preClose', 'close'], missing: [] });
    expect(earlyRow.agent.desks.shadow).toMatchObject({ status: 'done', source: 'model' });
    expect(earlyRow.agent.desks.archetype).toMatchObject({ status: 'done', source: 'model' });
    expect(results.find((r) => r.date === EARLY_CLOSE).agent).toMatchObject({ calls: 2, fallbacks: 0 });

    // THE SPEND (B9): 27 calls (26 and one retry), each reserved at its $0.1625 maximum and settled at what it cost (a
    // timeout at its whole maximum); November under $3.
    const book = getBook(ctx.db, ctx.bookId);
    const novCalls = results.filter((r) => r.date < '2026-12-01').length * 2 + 1;
    expect(book.spend.month).toBe('2026-12');
    expect(book.spend.lastMonth).toMatchObject({ month: '2026-11', calls: novCalls, exhausted: false });
    expect(book.spend.lastMonth.reservedUsd).toBeLessThan(MONTHLY_SPEND_BOUND_USD);
    expect(book.spend.lastMonth.reservedUsd).toBe(book.spend.lastMonth.settledUsd); // nothing left outstanding
    expect(bannedWordsOnResults(ctx.db)).toEqual([]);
  });
});

describe('the saved theses: the same history with their sub-switch on, and off', () => {
  it('ON: the Shadow desk reads the owner\'s saved thesis — quoted as untrusted player text — and drafts from it (origin research, the saved list its source)', { timeout: 60_000 }, async () => {
    const { ctx, fake, listId } = await runBook({ theses: true });
    const firstShadow = fake.calls.find((c) => c.desk === 'shadow');
    const msg = firstShadow.request.content.messages[0].content;
    expect(msg).toMatch(/<saved_thesis label="T1" trust="untrusted player text">/);
    expect(msg).not.toContain(listId); // the list's id never reaches the prompt: the label does
    expect(firstShadow.request.content.system[0].text).toMatch(/UNTRUSTED PLAYER TEXT/);
    expect(fake.calls.find((c) => c.desk === 'archetype').request.content.messages[0].content).not.toMatch(/saved_thesis/); // the Shadow desk only
    const long = ideasOf(ctx).find((i) => i.contract.slot === 'long');
    expect(long.contract).toMatchObject({ desk: 'shadow', names: ['AAPL', 'MSFT'], origin: { kind: 'research', initiatedBy: 'agent' }, sources: [{ kind: 'research', ref: listId }] });
    expect(deskPartsOf(ctx.db, ctx.bookId, DAYS.d1).shadow.manifest.counts.theses).toBe(1);
  });

  it('OFF: the same history reads no saved list, the prompt carries none, and the long idea comes from the price list', { timeout: 60_000 }, async () => {
    const { ctx, fake } = await runBook({ theses: false });
    for (const c of fake.calls) expect(c.request.content.messages[0].content).not.toMatch(/saved_thesis|Saved theses/);
    const long = ideasOf(ctx).find((i) => i.contract.slot === 'long');
    expect(long.contract.origin.kind).toBe('market_scan');
    expect(deskPartsOf(ctx.db, ctx.bookId, DAYS.d1).shadow.manifest.counts.theses).toBeNull();
  });
});

describe('the run is reproducible byte for byte', () => {
  // The pinned evidence. A change here is a change to what the agent's run records: re-pin it only with a reviewed change,
  // leaf-compared, and carry the figures into the build report.
  //   Build B2's first pin: d43681cb…a155c6, 828,454 bytes.
  //   The fix round (B2-A03, report §9): 830,894 bytes. Leaf-compared with the first pin, the ONLY changes are the 13 close
  //   rows' window-level summary — `modelCalled` false → true (13) and `outcome` no_model_action → model_action (3),
  //   model_no_change (9) or model_fallback (1) — and the 91 added `agent.summary` leaves; no leaf removed, no other changed.
  //   Build B4 (ruling B4-6: PRACTICE_FIELD_SLOTS_VERSION 2 → 3, B8_FOUNDER_BOOK_CAP 4 → 12): re-pinned from c1fca0d6…, 830,894
  //   bytes. With the two constants set back to 2 and 4 on the build's tree (every other B4 change in place, the run moved to
  //   __testsupport__/agentEndToEndRun.js), this run reproduces c1fca0d6… exactly — and foundersLiveBook.test.js pins that, at
  //   'allowlist' with the founder on the new player list. Leaf-compared at 3 and 12: the same 26,201 leaves, and the ONLY
  //   changed ones are the slots version (the book, its epoch's rails, each of the four ideas' contracts and admission packets:
  //   10 leaves), the four admission packets' derived `contentHash`, and the registry's `cap` (4 → 12, the one extra byte).
  const EXPECTED_AGENT_DUMP = { sha256: 'd45565abcdeedae9d0da36a09e843c6f5f5d2aff8269e3304034d007a7aacdeb', bytes: 830895 };
  it('the final store of the theses-off run, dumped and pinned', { timeout: 60_000 }, async () => {
    const { ctx } = await runBook({ theses: false });
    const dump = dumpStore(ctx.db);
    const evidence = { sha256: createHash('sha256').update(dump).digest('hex'), bytes: Buffer.byteLength(dump) };
    console.log(`PF_AGENT_E2E_EVIDENCE ${JSON.stringify(evidence)}`);
    expect(evidence).toEqual(EXPECTED_AGENT_DUMP);
  });
});
