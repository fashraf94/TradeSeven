// api/_utils/practiceField/foundersLiveBook.test.js
//
// Practice Field build B4, rule 5 — THE FOUNDER'S LIVE BOOK IS UNTOUCHED BY MERGING, provided his uid is on the new player
// list. A book created BEFORE this build (main's slots module: version 2, cap 4 — this file's one mock, completed from the
// real module) runs B2's thirteen-session end-to-end run with the agent on (__testsupport__/agentEndToEndRun.js, the very run
// agentEndToEnd.test.js pins) on THIS build's code, at PRACTICE_FIELD_MODE 'allowlist' with the founder on
// PRACTICE_FIELD_PLAYER_UIDS and nobody on the cockpit's list — and its final store is main's pinned dump, byte for byte
// (c1fca0d6…, 830,894 bytes; agentEndToEnd.test.js at main 22b01810). With the founder OFF the list, the desks still check his
// book and code still closes it and sells at its line, but every draft is refused `mode_not_admitted`.
//
// THE MERGE ITSELF (review B2): the book and the founder's medium idea made under main's constants, then the thirteen
// sessions under this build's (version 3, cap 12) — the real post-merge state. Its dump is pinned too, and leaf-compared with
// main's: the ONLY leaves that differ are the slots version on the ideas admitted after the merge (each contract and
// admission packet) and those packets' derived hashes. The book and its epoch keep version 2; nothing reads either.
// This file's import of mode.js is the dependency-surface guard for the api → src/config flag import (BUILD_RULES §4).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';

/** The slots module's two B4 values, as this file sets them: main's by default; a row may move them mid-run. */
const slots = vi.hoisted(() => ({ version: 2, cap: 4 }));
vi.mock('../../../src/data/practiceFieldSlots.js', async (importOriginal) => {
  const real = await importOriginal();
  const SLOTS = Object.freeze(Object.defineProperty({ ...real.PRACTICE_FIELD_SLOTS }, 'B8_FOUNDER_BOOK_CAP', { get: () => slots.cap, enumerable: true }));
  return { ...real, get PRACTICE_FIELD_SLOTS_VERSION() { return slots.version; }, PRACTICE_FIELD_SLOTS: SLOTS };
});

import { setPracticeFieldModeForTests, setPracticeFieldAgentForTests, practiceFieldAdmits } from './mode.js';
import { PRACTICE_FIELD_SLOTS_VERSION, PRACTICE_FIELD_SLOTS } from '../../../src/data/practiceFieldSlots.js';
import { PRACTICE_FIELD_PLAYER_ENV } from './playerList.js';
import { COCKPIT_ALLOWLIST_ENV } from '../callRecords/allowlist.js';
import { admitIdea } from './admission.js';
import { assertReconciled } from './reconcile.js';
import { runFoundersBook, sessions, scriptedDesks } from './__testsupport__/agentEndToEndRun.js';
import { seedBook, getBook, getIdea, etIso, DAYS, dumpStore } from './__testsupport__/fixtures.js';
import { quotesOn, foundersMediumIdea, fakeTransport, runSession, deskPartsOf } from './__testsupport__/agentFixtures.js';

/** main's pin of B2's run (agentEndToEnd.test.js at 22b01810). */
const MAIN_AGENT_DUMP = Object.freeze({ sha256: 'c1fca0d65138eee123fe85cdb91372b9e48c31e715e273d3d5c17de820f0a9f5', bytes: 830894 });
/** The merge's pin (review B2): main's constants for the book and the founder's idea, this build's for the thirteen sessions. */
const MERGE_DUMP = Object.freeze({ sha256: 'bede24afa16cb333e819fc6286069dbebe932b994704046f47bf439ff7d724b6', bytes: 830894 });
const FOUNDER = 'owner-1'; // the run's owner (fixtures.js seedBook)

let restoreMode;
let restoreAgent = () => {};
let errSpy;
beforeEach(() => {
  slots.version = 2;
  slots.cap = 4;
  restoreMode = setPracticeFieldModeForTests('allowlist');
  vi.stubEnv(COCKPIT_ALLOWLIST_ENV, '');
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { restoreAgent(); restoreAgent = () => {}; restoreMode(); errSpy.mockRestore(); vi.unstubAllEnvs(); });

describe('rule 5 — the founder\'s live book, created before B4, with the agent on', () => {
  it('the slots module here is main\'s (version 2, cap 4): the book is made as main made it', () => {
    expect(PRACTICE_FIELD_SLOTS_VERSION).toBe(2);
    expect(PRACTICE_FIELD_SLOTS.B8_FOUNDER_BOOK_CAP).toBe(4);
    expect(PRACTICE_FIELD_SLOTS.B1_SLOT_CAP_SHARE).toEqual({ short: 0.2, medium: 0.3, long: 0.4 }); // every other value real
  });

  it('ON the new player list, at \'allowlist\': the thirteen-session run closes and is checked exactly as on main — main\'s dump, byte for byte', { timeout: 120_000 }, async () => {
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, FOUNDER);
    expect(practiceFieldAdmits(FOUNDER)).toBe(true);
    const { ctx, fake } = await runFoundersBook({ theses: false, onRestore: (r) => { restoreAgent = r; } });
    expect(fake.calls).toHaveLength(27);
    const dump = dumpStore(ctx.db);
    const evidence = { sha256: createHash('sha256').update(dump).digest('hex'), bytes: Buffer.byteLength(dump) };
    console.log(`PF_B4_LIVE_BOOK_EVIDENCE ${JSON.stringify(evidence)}`);
    expect(evidence).toEqual(MAIN_AGENT_DUMP);
  });

  it('THE MERGE (review B2): the book and his idea made under main\'s constants, the thirteen sessions under this build\'s — only the slots version on ideas admitted after it, and their packets\' hashes, differ from main', { timeout: 240_000 }, async () => {
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, FOUNDER);
    const main = await runFoundersBook({ theses: false, onRestore: (r) => { restoreAgent = r; } });
    const mainDump = dumpStore(main.ctx.db);
    restoreAgent();
    const merged = await runFoundersBook({ theses: false, onRestore: (r) => { restoreAgent = r; }, afterSeed: () => { slots.version = 3; slots.cap = 12; } });
    const dump = dumpStore(merged.ctx.db);
    const evidence = { sha256: createHash('sha256').update(dump).digest('hex'), bytes: Buffer.byteLength(dump) };
    console.log(`PF_B4_MERGE_EVIDENCE ${JSON.stringify(evidence)}`);
    expect(createHash('sha256').update(mainDump).digest('hex')).toBe(MAIN_AGENT_DUMP.sha256);
    expect(evidence).toEqual(MERGE_DUMP);
    const leaves = (v, p = '', out = new Map()) => {
      if (v !== null && typeof v === 'object' && Object.keys(v).length > 0) for (const [k, x] of Object.entries(v)) leaves(x, `${p}/${k}`, out);
      else out.set(p, JSON.stringify(v));
      return out;
    };
    const a = leaves(JSON.parse(mainDump));
    const b = leaves(JSON.parse(dump));
    expect([...b.keys()].sort()).toEqual([...a.keys()].sort()); // no leaf added or removed
    const changed = [...a.keys()].filter((k) => a.get(k) !== b.get(k));
    for (const k of changed) expect(k).toMatch(/^\/mandates\/[^/]+\/ideas\/[^/]+\/(contract\/slotsVersion|evidence\/admission\/contract\/slotsVersion|evidence\/admission\/contentHash)$/);
    const versions = changed.filter((k) => k.endsWith('slotsVersion'));
    expect(versions.every((k) => a.get(k) === '2' && b.get(k) === '3')).toBe(true);
    expect(changed.filter((k) => k.endsWith('/contract/slotsVersion') && !k.includes('/evidence/'))).toHaveLength(3); // the three ideas the desks admitted after it
    expect(changed).toHaveLength(9);
    // The book, its epoch and the registry keep what they were made with; the founder's own idea too.
    const book = getBook(merged.ctx.db, merged.ctx.bookId);
    expect(book.slotsVersion).toBe(2);
    expect(merged.ctx.db._get(`mandates/${merged.ctx.bookId}/epochs/epoch-0001`).rails.slotsVersion).toBe(2);
    expect(merged.ctx.db._get('practiceFieldBooks/_registry').cap).toBe(4);
    expect(getIdea(merged.ctx.db, merged.ctx.bookId, merged.mediumId).contract.slotsVersion).toBe(2);
  });

  it('the control: the same run with the founder on the COCKPIT\'s list only is not main\'s run — his drafts are refused, so the pin above is not vacuous', { timeout: 120_000 }, async () => {
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, '');
    vi.stubEnv(COCKPIT_ALLOWLIST_ENV, FOUNDER);
    await expect(runFoundersBook({ theses: false, onRestore: (r) => { restoreAgent = r; } })).rejects.toThrow(/seedBook: mode_not_admitted/);
  });

  it('OFF the list (removed after his book and idea were made): the desks still check it, code still closes it and sells at its line, and every draft is refused mode_not_admitted', { timeout: 120_000 }, async () => {
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, FOUNDER);
    restoreAgent = setPracticeFieldAgentForTests({ agent: true, theses: false });
    const ctx = await seedBook({ nowIso: etIso(DAYS.admit, 9, 0) });
    const medium = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: foundersMediumIdea(), opId: 'founder-medium', nowIso: etIso(DAYS.admit, 11, 0) });
    expect(medium.ok).toBe(true);
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, 'someone-else'); // the founder removed from the list
    expect(practiceFieldAdmits(FOUNDER)).toBe(false);
    let current = null;
    const fake = fakeTransport(scriptedDesks(() => current));
    const days = sessions();
    for (const [i, date] of days.entries()) {
      current = date;
      // BAC falls 12% from 19 Nov: below the founder's 10% line — code sells.
      const quotes = quotesOn({ drift: i * 0.002, moves: date >= '2026-11-19' ? { BAC: -0.12 } : {} });
      const out = await runSession(ctx.db, ctx.bookId, date, { quotes, transport: fake.transport });
      expect(out.close.closed, date).toBe(true); // code closes every session
      const book = getBook(ctx.db, ctx.bookId);
      expect(book.execState.lastCloseKey, date).toBe(date);
      assertReconciled(book, book.openIdeaIds.map((id) => getIdea(ctx.db, ctx.bookId, id)));
    }
    // The desks checked the book every session (the scripted Shadow failure on 24 Nov aside).
    expect(fake.calls.length).toBeGreaterThanOrEqual(days.length);
    // Every draft either desk made was refused; each that reached admission names mode_not_admitted. The one that did not is
    // the script's day-1 draft outside the rails, refused on its own shape before admission is asked (as on the list).
    const considered = days.flatMap((d) => Object.values(deskPartsOf(ctx.db, ctx.bookId, d) || {}).flatMap((p) => p?.considered || []));
    for (const c of considered) expect(c.outcome).toBe('refused');
    const shapeOnly = considered.filter((c) => c.refusals.some((r) => r.code === 'line_distance_out_of_band'));
    const admissionRefused = considered.filter((c) => !shapeOnly.includes(c));
    expect(shapeOnly).toHaveLength(1);
    expect(admissionRefused.length).toBeGreaterThan(5);
    for (const c of admissionRefused) expect(c.refusals.map((r) => r.code)).toContain('mode_not_admitted');
    const ideaPaths = [...ctx.db._store.keys()].filter((p) => new RegExp(`^mandates/${ctx.bookId}/ideas/[^/]+$`).test(p));
    expect(ideaPaths).toEqual([`mandates/${ctx.bookId}/ideas/${medium.ideaId}`]);
    // Code sold at the line: BAC crossed the founder's line and code sold it; the idea holds on with JPM and GS.
    const idea = getIdea(ctx.db, ctx.bookId, medium.ideaId);
    expect(idea.ledger.saleReceipts.map((r) => r.symbol)).toEqual(['BAC']);
    expect(Object.keys(idea.ledger.holdings).sort()).toEqual(['GS', 'JPM']);
    expect(idea.status).toBe('holding');
  });
});
