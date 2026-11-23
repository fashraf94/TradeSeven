// scripts/practice-field-founder.test.js
//
// Practice Field B0 — the founder's command-line door (scripts/practice-field-founder.mjs), on the in-memory Firestore
// harness (api/_utils/__testsupport__/mandateFakeFirestore.js through the practice field's fixtures). Nothing here reads
// an environment file or a credential: the script's `runCli` is handed the in-memory db.
//
// What the rows hold:
//   • the command line: every bad line refused, --help touching nothing;
//   • THE GATES: the mode, the founder list and --go — each refusing alone, with nothing read or written;
//   • each command with --go, through the door's own dispatcher; the door's refusals passed through with their codes;
//     a re-run answered by the door's replay, writing nothing;
//   • admit --dry-run is the door's own admission: across a table of cases its refusals equal what --go then answers,
//     and it writes nothing;
//   • status: the book, its slots and lines, the parse-report alerts of the book's own symbols, and no other user's ids;
//   • the records status lists are the door's own records: each id, handed to the door's ruling planner, is found —
//     over the corporate-action sequence harness's histories, every kind reached;
//   • the shipped examples are valid: the idea admits end to end, each ruling is shaped as the door reads it;
//   • the script's source writes nothing itself: one call of runFounderAction, no write call.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  runCli, parseArgs, parseRequestText, bodyWithoutKey, requestKeyFor, openRecordsOf, sessionsLeft, readOnlyView,
  RESOLVE_FIELDS, DECISIONS_OF, COMMANDS, EXIT, isDirectRun,
} from './practice-field-founder.mjs';
import { setPracticeFieldModeForTests } from '../api/_utils/practiceField/mode.js';
import { COCKPIT_ALLOWLIST_ENV } from '../api/_utils/callRecords/allowlist.js';
import { normalizeIdeaContract } from '../api/_utils/practiceField/contract.js';
import { planHoldRuling, HOLD_KINDS } from '../api/_utils/practiceField/holdRulings.js';
import { createIdeaBook } from '../api/_utils/practiceField/ideaBook.js';
import { admitIdea } from '../api/_utils/practiceField/admission.js';
import {
  makeMandateFakeDb, contractOf, etIso, ADMIT_ISO, DAYS, getBook, getIdea, dumpStore, enterAt, closeOn, storeParseReport,
  storeTickSnapshot, closeNowOf, takeSeededDbs, CLEAN_PARSE_ENTRY,
} from '../api/_utils/practiceField/__testsupport__/fixtures.js';
import { runIdeaBookEvalPass } from '../api/_utils/practiceField/sweep.js';
import { tickOf, slotNowOf } from '../api/_utils/practiceField/__testsupport__/fixtures.js';
import {
  run as runSequence, installSequenceHooks, FIXED, FIXED_LATE, ASTRA_T2E, generateWide, generateLate, S as SEQ,
} from '../api/_utils/practiceField/__testsupport__/caSequences.js';
import { parseSplitsPayload } from '../api/_utils/mandateCorporateActions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(HERE, 'practice-field-founder.mjs');
const EXAMPLES_DIR = path.join(HERE, 'practice-field-founder.examples');
const exampleText = (name) => readFileSync(path.join(EXAMPLES_DIR, name), 'utf8');

const UID = 'founder-b0';
const OTHER = 'zz-other-owner-7731';
const S = ['2026-11-16', '2026-11-17', '2026-11-18'];
const QUOTES = { AAPL: { price: 231.47, marketCap: 3.4e12 }, MSFT: { price: 418.13, marketCap: 3.1e12 }, NVDA: { price: 141.29, marketCap: 3.5e12 }, SPY: 597.31 };
const agents = (uid = UID) => ({
  [`agents/agent-${uid}`]: { ownerId: uid, archetype: 'momentum_chaser', name: 'Ranked' },
  [`agents/casual-agent-${uid}`]: { ownerId: uid, archetype: 'momentum_chaser', isCasualClone: true, rankedAgentId: `agent-${uid}` },
});
const fixtureFile = (contract) => JSON.stringify(contract);

/** Run the command line against `db` (or a db that refuses every touch), collecting what it prints. */
async function cli(db, args, { nowIso = ADMIT_ISO, files = {} } = {}) {
  const lines = [];
  let dbAsked = 0;
  const code = await runCli(args, {
    getDb: async () => { dbAsked += 1; return db; },
    nowIso: () => nowIso,
    print: (s) => lines.push(String(s)),
    readFile: (p) => {
      const name = Object.keys(files).find((f) => path.resolve(f) === p);
      if (name === undefined) throw Object.assign(new Error('not found'), { code: 'ENOENT' });
      return files[name];
    },
  });
  return { code, out: lines.join('\n'), dbAsked };
}
const json = async (db, args, opts) => {
  const r = await cli(db, [...args, '--json'], opts);
  return { code: r.code, body: JSON.parse(r.out) };
};
/** A db that fails the row on ANY read, write or transaction. */
const untouchable = () => ({
  collection: () => { throw new Error('a read was made'); },
  runTransaction: () => { throw new Error('a transaction was opened'); },
});

let restoreMode;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('on');
  vi.stubEnv('MANDATE_FOUNDER_UIDS', ` someone-else , ${UID} `);
  vi.stubEnv(COCKPIT_ALLOWLIST_ENV, UID);
});
afterEach(() => {
  restoreMode();
  vi.unstubAllEnvs();
});

/** A db with the founder's book (created through the script) and, optionally, one admitted idea. */
async function founderBook({ contract = null, db = makeMandateFakeDb(agents()) } = {}) {
  const made = await json(db, ['create-book', '--uid', UID, '--go']);
  expect(made.code).toBe(EXIT.DONE);
  const bookId = made.body.answer.bookId;
  let ideaId = null;
  if (contract) {
    const admitted = await json(db, ['admit', '--file', 'c.json', '--uid', UID, '--go'], { files: { 'c.json': fixtureFile(contract) } });
    expect(admitted.code, JSON.stringify(admitted.body.answer)).toBe(EXIT.DONE);
    ideaId = admitted.body.answer.ideaId;
  }
  return { db, bookId, ideaId };
}

// ── THE COMMAND LINE ────────────────────────────────────────────────────────────────────────────────────────────────────

describe('the command line', () => {
  it('every command is the door\'s action (status reads only)', () => {
    expect(COMMANDS).toEqual({ status: null, 'create-book': 'create_book', admit: 'admit_fixture', resolve: 'resolve_hold', pause: 'pause', resume: 'resume', 'wind-down': 'wind_down' });
  });

  it.each([
    [['delete-book', '--uid', UID], /unknown command/],
    [['status'], /--uid <uid> is required/],
    [['status', '--uid'], /needs a value/],
    [['status', '--uid', '--json'], /needs a value/],
    [['status', '--uid', UID, '--go'], /not an option of status/],
    [['pause', '--uid', UID, '--dry-run'], /not an option of pause/],
    [['resolve', '--file', 'r.json', '--uid', UID, '--dry-run'], /not an option of resolve/],
    [['create-book', '--uid', UID, '--file', 'x.json'], /not an option of create-book/],
    [['admit', '--uid', UID], /needs --file/],
    [['resolve', '--uid', UID, '--go'], /needs --file/],
    [['admit', '--file', 'c.json', '--uid', UID, '--dry-run', '--go'], /choose one/],
    [['pause', '--uid', UID, '--go', '--go'], /given twice/],
    [['pause', '--uid', UID, '--GO'], /unknown argument/],
    [['pause', '--uid', UID, 'go'], /unknown argument/],
    [['pause', '--uid', UID, '--go=yes'], /takes no value/],
  ])('refuses %j, exit 1, touching nothing', async (argv, why) => {
    expect(() => parseArgs(argv)).toThrow(why);
    const r = await cli(untouchable(), argv);
    expect(r.code).toBe(EXIT.FAILED);
    expect(r.dbAsked).toBe(0);
    expect(r.out).toMatch(/^FAILED: /);
  });

  it('--help (or nothing) prints the usage and touches nothing — no credential is loaded', async () => {
    for (const argv of [[], ['--help'], ['status', '--help'], ['-h']]) {
      const r = await cli(untouchable(), argv);
      expect(r.code, String(argv)).toBe(EXIT.DONE);
      expect(r.dbAsked).toBe(0);
      expect(r.out).toContain('node scripts/practice-field-founder.mjs status');
    }
  });

  it('--uid=<uid> and --file=<file> forms are read as the spaced forms', () => {
    expect(parseArgs(['admit', '--file=c.json', '--uid=u-1', '--dry-run'])).toMatchObject({ command: 'admit', file: 'c.json', uid: 'u-1', dryRun: true, go: false });
  });
});

// ── THE GATES ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const WRITE_COMMANDS = [
  ['create-book', []],
  ['admit', ['--file', 'c.json']],
  ['resolve', ['--file', 'r.json']],
  ['pause', []],
  ['resume', []],
  ['wind-down', []],
];
const GATE_FILES = { 'c.json': fixtureFile(contractOf()), 'r.json': exampleText('resolve-conflict.example.json') };

describe('the gates — the mode, the founder list, --go: each refuses alone', () => {
  it.each(WRITE_COMMANDS)('%s: mode \'off\' → exit 2, nothing read, nothing sent', async (command, extra) => {
    setPracticeFieldModeForTests('off');
    const r = await cli(untouchable(), [command, ...extra, '--uid', UID, '--go'], { files: GATE_FILES });
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.out).toContain('REFUSED (mode)');
    expect(r.out).not.toContain('SENT ');
  });

  it.each(WRITE_COMMANDS)('%s: a uid off MANDATE_FOUNDER_UIDS → exit 2, nothing read, nothing sent', async (command, extra) => {
    for (const list of ['someone-else', '', ' , ']) {
      vi.stubEnv('MANDATE_FOUNDER_UIDS', list);
      const r = await cli(untouchable(), [command, ...extra, '--uid', UID, '--go'], { files: GATE_FILES });
      expect(r.code, String(list)).toBe(EXIT.REFUSED);
      expect(r.out).toContain('REFUSED (founder)');
    }
  });

  it.each(WRITE_COMMANDS)('%s: without --go → exit 2, prints the exact body it would send, writes nothing', async (command, extra) => {
    const { db } = await founderBook({ contract: command === 'create-book' ? null : contractOf({ names: ['MSFT'], slot: 'long' }) });
    const before = dumpStore(db);
    const r = await json(db, [command, ...extra, '--uid', UID], { files: GATE_FILES });
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.body).toMatchObject({ sent: false, refused: [{ gate: 'go' }] });
    expect(r.body.body).toMatchObject({ action: COMMANDS[command], requestKey: expect.stringMatching(/^pf-/) });
    expect(dumpStore(db)).toBe(before);
    const text = await cli(db, [command, ...extra, '--uid', UID], { files: GATE_FILES });
    expect(text.out).toContain('REFUSED (go): not sent: add --go to send it');
    expect(text.out).toContain(`WOULD SEND       ${JSON.stringify(r.body.body)}`);
  });

  it('status and admit --dry-run are gated too: nothing is read for a uid that is not a founder, or at \'off\'', async () => {
    for (const args of [['status', '--uid', UID], ['admit', '--file', 'c.json', '--dry-run', '--uid', UID]]) {
      vi.stubEnv('MANDATE_FOUNDER_UIDS', 'someone-else');
      expect((await cli(untouchable(), args, { files: GATE_FILES })).code, String(args)).toBe(EXIT.REFUSED);
      vi.stubEnv('MANDATE_FOUNDER_UIDS', UID);
      setPracticeFieldModeForTests('off');
      const off = await cli(untouchable(), args, { files: GATE_FILES });
      expect(off.code).toBe(EXIT.REFUSED);
      expect(off.out).toContain('REFUSED (mode)');
      setPracticeFieldModeForTests('on');
    }
  });

  it('the gates read the founder list and the mode NOW: the same process refuses, then sends', async () => {
    const db = makeMandateFakeDb(agents());
    vi.stubEnv('MANDATE_FOUNDER_UIDS', 'someone-else');
    expect((await cli(db, ['create-book', '--uid', UID, '--go'])).code).toBe(EXIT.REFUSED);
    expect(db._get(`practiceFieldBooks/${UID}`)).toBeUndefined();
    vi.stubEnv('MANDATE_FOUNDER_UIDS', UID);
    expect((await cli(db, ['create-book', '--uid', UID, '--go'])).code).toBe(EXIT.DONE);
  });
});

// ── EACH COMMAND, WITH --go ─────────────────────────────────────────────────────────────────────────────────────────────

describe('each command with --go — the door\'s own dispatcher', () => {
  it('create-book creates the book for the uid\'s ranked agent; a re-run is the door\'s replay and writes nothing', async () => {
    const db = makeMandateFakeDb(agents());
    const made = await json(db, ['create-book', '--uid', UID, '--go']);
    expect(made).toMatchObject({ code: EXIT.DONE, body: { sent: true, httpStatus: 201, replay: false, answer: { ok: true, attributionAgentId: `agent-${UID}` } } });
    expect(getBook(db, made.body.answer.bookId)).toMatchObject({ userId: UID, status: 'active', drafting: 'on' });
    const bytes = dumpStore(db);
    const again = await cli(db, ['create-book', '--uid', UID, '--go']);
    expect(again.code).toBe(EXIT.DONE);
    expect(again.out).toContain('REPLAY: this exact request was already sent');
    expect(dumpStore(db)).toBe(bytes);
  });

  it('create-book --agent names one of the uid\'s ranked agents; two without --agent is the door\'s 409, passed through (exit 2)', async () => {
    const db = makeMandateFakeDb({ ...agents(), [`agents/agent-second-${UID}`]: { ownerId: UID, archetype: 'degen' } });
    const ambiguous = await cli(db, ['create-book', '--uid', UID, '--go']);
    expect(ambiguous.code).toBe(EXIT.REFUSED);
    expect(ambiguous.out).toContain('door answered   409 REFUSED: ranked_agent_ambiguous');
    const named = await json(db, ['create-book', '--agent', `agent-second-${UID}`, '--uid', UID, '--go']);
    expect(named).toMatchObject({ code: EXIT.DONE, body: { body: { action: 'create_book', agentId: `agent-second-${UID}` }, answer: { archetypeCodeId: 'degen' } } });
  });

  it('admit sends the file\'s contract (its _notes removed); the door admits it as a founder fixture; a re-run replays', async () => {
    const { db, bookId } = await founderBook();
    const file = exampleText('medium-idea.example.json');
    const r = await json(db, ['admit', '--file', 'idea.json', '--uid', UID, '--go'], { files: { 'idea.json': file } });
    expect(r).toMatchObject({ code: EXIT.DONE, body: { httpStatus: 201, answer: { ok: true, status: 'accepted', bookId } } });
    expect(r.body.body.contract).toEqual(parseRequestText(file));
    expect(r.body.body.contract._notes).toBeUndefined();
    expect(getIdea(db, bookId, r.body.answer.ideaId).contract).toMatchObject({ slot: 'medium', names: ['JPM', 'BAC', 'GS'], origin: { kind: 'founder_fixture', initiatedBy: 'agent' } });
    const bytes = dumpStore(db);
    const again = await json(db, ['admit', '--file', 'idea.json', '--uid', UID, '--go'], { files: { 'idea.json': file } });
    expect(again).toMatchObject({ code: EXIT.DONE, body: { replay: true, answer: { ideaId: r.body.answer.ideaId, idempotentReplay: true } } });
    expect(dumpStore(db)).toBe(bytes);
  });

  it('the door\'s refusal is passed through with every code: an occupied slot is 422 slot_occupied, exit 2', async () => {
    const { db } = await founderBook({ contract: contractOf() });
    const r = await cli(db, ['admit', '--file', 'msft.json', '--uid', UID, '--go'], { files: { 'msft.json': fixtureFile(contractOf({ names: ['MSFT'] })) } });
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.out).toContain('door answered   422 REFUSED: admission_refused');
    expect(r.out).toMatch(/^ {2}slot_occupied {3}\{"slot":"short","ideaId":"idea_/m);
  });

  it('pause, resume and wind-down act on the open book; pause replayed after a resume says so, and names the book as it is now', async () => {
    const { db, bookId } = await founderBook();
    expect((await json(db, ['pause', '--uid', UID, '--go'])).body.answer).toMatchObject({ ok: true, outcome: 'paused', drafting: 'paused' });
    expect(getBook(db, bookId).drafting).toBe('paused');
    expect((await json(db, ['resume', '--uid', UID, '--go'])).body.answer).toMatchObject({ outcome: 'resumed', drafting: 'on' });
    const replayed = await cli(db, ['pause', '--uid', UID, '--go']);
    expect(replayed.code).toBe(EXIT.DONE);
    expect(replayed.out).toContain('REPLAY: this exact request was already sent');
    expect(replayed.out).toContain('book now        active, drafting on');
    expect(getBook(db, bookId).drafting).toBe('on');
    expect((await json(db, ['wind-down', '--uid', UID, '--go'])).body.answer).toMatchObject({ outcome: 'draining', status: 'draining' });
    expect(getBook(db, bookId).status).toBe('draining');
  });

  it('with no open book, the door answers no_open_book (404, exit 2) for pause, admit and resolve', async () => {
    const db = makeMandateFakeDb(agents());
    for (const [command, extra] of [['pause', []], ['admit', ['--file', 'c.json']], ['resolve', ['--file', 'r.json']]]) {
      const r = await json(db, [command, ...extra, '--uid', UID, '--go'], { files: GATE_FILES });
      expect(r.code, command).toBe(EXIT.REFUSED);
      expect(r.body.answer.error, command).toBe('no_open_book');
    }
  });

  it('resolve sends ONLY the ruling fields the door reads: a file\'s own `action` or `requestKey` never reaches it', async () => {
    const { db, bookId, ideaId } = await founderBook({ contract: contractOf() });
    const sneaky = JSON.stringify({ action: 'wind_down', requestKey: 'chosen-key', uid: OTHER, ideaId, kind: 'conflict', recordId: 'cash_dividend_AAPL_2026-11-16', decision: 'none', extra: 1 });
    const r = await json(db, ['resolve', '--file', 'r.json', '--uid', UID, '--go'], { files: { 'r.json': sneaky } });
    expect(Object.keys(r.body.body).sort()).toEqual(['action', 'decision', 'ideaId', 'kind', 'recordId', 'requestKey']);
    expect(r.body.body.action).toBe('resolve_hold');
    expect(r.body.body.requestKey).not.toBe('chosen-key');
    expect(r.body.answer).toMatchObject({ ok: false, error: 'record_not_found' });
    expect(r.code).toBe(EXIT.REFUSED);
    expect(getBook(db, bookId).status).toBe('active');
  });

  it('a file that is not JSON, or not one object, is refused before anything is read (exit 1)', async () => {
    for (const text of ['{ not json', '[1, 2]', '"x"', 'null']) {
      const r = await cli(untouchable(), ['resolve', '--file', 'r.json', '--uid', UID, '--go'], { files: { 'r.json': text } });
      expect(r.code, text).toBe(EXIT.FAILED);
      expect(r.dbAsked, text).toBe(0);
    }
    expect((await cli(untouchable(), ['admit', '--file', 'missing.json', '--uid', UID, '--go'])).out).toContain('cannot read missing.json (ENOENT)');
  });
});

describe('the request key — the door\'s idempotent replay', () => {
  it('is derived from the command, what it sends and the book; `_notes` changes nothing; a changed file is a new key', () => {
    const contract = contractOf();
    const a = requestKeyFor(bodyWithoutKey('admit', { fileValue: parseRequestText(JSON.stringify({ ...contract, _notes: ['x'] })) }), 'book-1');
    const b = requestKeyFor(bodyWithoutKey('admit', { fileValue: parseRequestText(JSON.stringify(contract, null, 4)) }), 'book-1');
    expect(a).toBe(b);
    expect(a).toMatch(/^pf-admit_fixture-[0-9a-f]{24}$/);
    expect(requestKeyFor(bodyWithoutKey('admit', { fileValue: { ...contract, capitalUsd: 19000 } }), 'book-1')).not.toBe(a);
    expect(requestKeyFor(bodyWithoutKey('admit', { fileValue: contract }), 'book-2')).not.toBe(a);
    expect(requestKeyFor(bodyWithoutKey('pause'), 'book-1')).not.toBe(requestKeyFor(bodyWithoutKey('resume'), 'book-1'));
    expect(requestKeyFor(bodyWithoutKey('pause'), 'book-1')).not.toBe(requestKeyFor(bodyWithoutKey('pause'), 'book-2'));
    expect(requestKeyFor(bodyWithoutKey('create-book', { agentId: 'a' }))).not.toBe(requestKeyFor(bodyWithoutKey('create-book')));
  });
});

// ── A STORED REFUSAL, AND --again (the refuter's F1) ────────────────────────────────────────────────────────────────────

describe('a stored refusal is the door\'s replay — the dry run says so, and --again sends a new request', () => {
  it('without --again every key is as before; with it the key differs, and only a plain word is taken', () => {
    const body = bodyWithoutKey('pause');
    expect(requestKeyFor(body, 'book-1', null)).toBe(requestKeyFor(body, 'book-1'));
    expect(requestKeyFor(body, 'book-1', 'two')).not.toBe(requestKeyFor(body, 'book-1'));
    expect(requestKeyFor(body, 'book-1', 'two')).not.toBe(requestKeyFor(body, 'book-1', 'three'));
    expect(parseArgs(['pause', '--uid', UID, '--again', 'second-try_2'])).toMatchObject({ again: 'second-try_2' });
    for (const bad of ['two words', 'x/y', '', 'a'.repeat(41)]) expect(() => parseArgs(['pause', '--uid', UID, `--again=${bad}`]), bad).toThrow();
    expect(() => parseArgs(['status', '--uid', UID, '--again', 'x'])).toThrow(/not an option of status/);
  });

  it('a refusal while paused is replayed after the resume: the dry run names the replay (exit 2), --go replays it, --again admits', async () => {
    const { db } = await founderBook();
    const files = { 'c.json': fixtureFile(contractOf()) };
    expect((await json(db, ['pause', '--uid', UID, '--go'])).code).toBe(EXIT.DONE);
    const refused = await json(db, ['admit', '--file', 'c.json', '--uid', UID, '--go'], { files });
    expect(refused.body.answer.refusals.map((r) => r.code)).toContain('drafting_paused');
    expect((await json(db, ['resume', '--uid', UID, '--go'])).code).toBe(EXIT.DONE);
    const before = dumpStore(db);
    const dry = await json(db, ['admit', '--file', 'c.json', '--dry-run', '--uid', UID], { files });
    expect(dumpStore(db)).toBe(before);
    expect(dry.code).toBe(EXIT.REFUSED);
    expect(dry.body.stored).toMatchObject({ kind: 'replay', httpStatus: 422, answer: { error: 'admission_refused' } });
    expect(dry.body.verdict.ok).toBe(true); // admission as it stands now, for a NEW request
    expect((await cli(db, ['admit', '--file', 'c.json', '--dry-run', '--uid', UID], { files })).out).toContain('--go WOULD REPLAY the answer stored under this key');
    const go = await cli(db, ['admit', '--file', 'c.json', '--uid', UID, '--go'], { files });
    expect(go.code).toBe(EXIT.REFUSED);
    expect(go.out).toContain('add --again <word>');
    const again = await json(db, ['admit', '--file', 'c.json', '--again', 'after-resume', '--uid', UID, '--go'], { files });
    expect(again).toMatchObject({ code: EXIT.DONE, body: { httpStatus: 201, answer: { ok: true, status: 'accepted' } } });
  });

  it('create-book refused mode_not_admitted at \'allowlist\' stays refused once the list holds the uid — until --again', async () => {
    const db = makeMandateFakeDb(agents());
    setPracticeFieldModeForTests('allowlist');
    vi.stubEnv(COCKPIT_ALLOWLIST_ENV, 'someone-else');
    expect((await json(db, ['create-book', '--uid', UID, '--go'])).body.answer).toMatchObject({ error: 'mode_not_admitted' });
    vi.stubEnv(COCKPIT_ALLOWLIST_ENV, UID);
    expect((await json(db, ['create-book', '--uid', UID, '--go'])).body).toMatchObject({ replay: true, answer: { error: 'mode_not_admitted' } });
    expect((await json(db, ['create-book', '--uid', UID, '--again', 'listed', '--go'])).body).toMatchObject({ httpStatus: 201, answer: { ok: true } });
  });

  it('after the book closes, create-book replays the first creation; --again makes the next book', async () => {
    const { db, bookId } = await founderBook();
    // The book closed (close.js: the claim released, the book closed) — as the store stands after a completed wind-down.
    db._store.delete(`practiceFieldBooks/${UID}`);
    db._store.set(`mandates/${bookId}`, { data: { ...getBook(db, bookId), status: 'closed' }, version: 99 });
    const replay = await json(db, ['create-book', '--uid', UID, '--go']);
    expect(replay.body).toMatchObject({ replay: true, answer: { bookId } });
    const next = await json(db, ['create-book', '--uid', UID, '--again', 'book-2', '--go']);
    expect(next.body).toMatchObject({ httpStatus: 201, answer: { ok: true } });
    expect(next.body.answer.bookId).not.toBe(bookId);
  });

  it('pause → resume → pause --again pauses the book again', async () => {
    const { db, bookId } = await founderBook();
    await cli(db, ['pause', '--uid', UID, '--go']);
    await cli(db, ['resume', '--uid', UID, '--go']);
    expect((await json(db, ['pause', '--uid', UID, '--again', '2', '--go'])).body.answer).toMatchObject({ outcome: 'paused' });
    expect(getBook(db, bookId).drafting).toBe('paused');
  });
});

describe('the direct-run check (the refuter\'s F2): the full path, never a file-name suffix', () => {
  it('runs only when argv[1] is this very file', () => {
    const url = pathToFileURL(SCRIPT_PATH).href;
    expect(isDirectRun(url, SCRIPT_PATH)).toBe(true);
    expect(isDirectRun(url, path.relative(process.cwd(), SCRIPT_PATH))).toBe(true);
    for (const other of ['founder.mjs', '-founder.mjs', 'r.mjs', path.join(HERE, 'founder.mjs'), path.join(HERE, 'x-practice-field-founder.mjs'), '', undefined]) {
      expect(isDirectRun(url, other), String(other)).toBe(false);
    }
  });
});

// ── ADMIT --dry-run: the door's own admission, nothing written ──────────────────────────────────────────────────────────

describe('admit --dry-run — the door\'s admission on a read-only view: its answer is what --go then gets, and it writes nothing', () => {
  const codes = (refusals) => (refusals || []).map((r) => r.code);

  /** Dry run, then --go, of one file at one instant: the dry run's verdict must be the door's. */
  async function differential(db, contract, nowIso = ADMIT_ISO) {
    const files = { 'c.json': fixtureFile(contract) };
    const before = dumpStore(db);
    const dry = await json(db, ['admit', '--file', 'c.json', '--dry-run', '--uid', UID], { files, nowIso });
    expect(dumpStore(db), 'the dry run wrote').toBe(before);
    const go = await json(db, ['admit', '--file', 'c.json', '--uid', UID, '--go'], { files, nowIso });
    return { dry: dry.body, dryCode: dry.code, go: go.body, goCode: go.code };
  }

  it('a clean admission: dry run ADMITTED (exit 0), naming the idea --go then makes, and what it would write', async () => {
    const { db, bookId } = await founderBook();
    const { dry, dryCode, go } = await differential(db, parseRequestText(exampleText('medium-idea.example.json')));
    expect(dryCode).toBe(EXIT.DONE);
    expect(dry.verdict).toMatchObject({ ok: true, replay: false });
    expect(go.answer).toMatchObject({ ok: true, ideaId: dry.verdict.ideaId, permittedMaxUsd: dry.verdict.permittedMaxUsd, startSession: dry.verdict.startSession, dueSession: dry.verdict.dueSession });
    expect(dry.wouldWrite.map((w) => `${w.op} ${w.path}`).sort()).toEqual([
      'create mandates/' + bookId + '/ideas/' + dry.verdict.ideaId + '/evidence/admission',
      'set mandates/' + bookId + '/ideas/' + dry.verdict.ideaId,
      'set practiceFieldCoverage/current',
      'update mandates/' + bookId,
    ].sort());
    // Re-run after --go: the dry run says the key is already admitted (--go would replay).
    const after = await json(db, ['admit', '--file', 'c.json', '--dry-run', '--uid', UID], { files: { 'c.json': fixtureFile(parseRequestText(exampleText('medium-idea.example.json'))) } });
    expect(after.body.verdict).toMatchObject({ ok: true, replay: true, ideaId: dry.verdict.ideaId });
  });

  it.each([
    ['an occupied slot', { setup: 'idea', contract: contractOf({ names: ['MSFT'] }) }],
    ['capital over the slot cap', { contract: contractOf({ slot: 'medium', names: ['MSFT'], capitalUsd: 35000 }) }],
    ['a malformed contract (no names, a bad slot)', { contract: { ...contractOf(), names: [], slot: 'forever' } }],
    ['a name already held by another idea', { setup: 'idea', contract: contractOf({ slot: 'long', names: ['AAPL'] }) }],
    ['\'allowlist\' with the uid off the cockpit list', { mode: 'allowlist', cockpit: 'someone-else', contract: contractOf() }],
    ['a close owed (Friday unclosed, Monday 11:00)', { contract: contractOf(), nowIso: etIso(S[0], 11, 0) }],
    ['a held name with no mark in the set (Tuesday 09:45)', { setup: 'held', contract: contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 1000 }), nowIso: etIso(S[1], 9, 45) }],
  ])('%s: the dry run\'s refusals are exactly the door\'s (exit 2 both)', async (_label, { setup, contract, mode, cockpit, nowIso = ADMIT_ISO }) => {
    const { db, bookId } = await founderBook({ contract: setup ? contractOf({ names: setup === 'held' ? ['AAPL', 'MSFT'] : ['AAPL'] }) : null });
    if (setup === 'held') {
      await storeTickSnapshot(db, S[0], 'open30', QUOTES);
      expect((await runIdeaBookEvalPass(db, { tick: tickOf(S[0]), now: slotNowOf(S[0]), ownerToken: 'owner-token' })).entered).toBe(1);
      await closeOn(db, bookId, S[0], QUOTES);
    }
    if (mode) setPracticeFieldModeForTests(mode);
    if (cockpit) vi.stubEnv(COCKPIT_ALLOWLIST_ENV, cockpit);
    const { dry, dryCode, go, goCode } = await differential(db, contract, nowIso);
    expect(dryCode).toBe(EXIT.REFUSED);
    expect(goCode).toBe(EXIT.REFUSED);
    expect(dry.verdict.ok).toBe(false);
    expect(codes(dry.verdict.refusals).length).toBeGreaterThan(0);
    expect(dry.verdict.refusals).toEqual(go.answer.refusals);
    expect(dry.verdict.permittedMaxUsd).toEqual(go.answer.permittedMaxUsd);
    expect(dry.verdict.binding).toEqual(go.answer.binding);
  });

  it('a contract asking another origin: the door forces a founder fixture, and so does the dry run (both admit it)', async () => {
    const { db } = await founderBook();
    const asked = { ...contractOf(), origin: { kind: 'signaldrop', initiatedBy: 'player' } };
    expect(normalizeIdeaContract(asked).refusals.map((r) => r.code)).toEqual(['origin_invalid']);
    const { dry, dryCode, go } = await differential(db, asked);
    expect(dryCode).toBe(EXIT.DONE);
    expect(dry.verdict).toMatchObject({ ok: true });
    expect(go.answer).toMatchObject({ ok: true, ideaId: dry.verdict.ideaId });
  });

  it('the price list: each name, the comparison and SPY, priced or not in the latest snapshot', async () => {
    const { db } = await founderBook();
    await storeTickSnapshot(db, S[0], 'open30', { AAPL: QUOTES.AAPL, SPY: 597.31 });
    const r = await json(db, ['admit', '--file', 'c.json', '--dry-run', '--uid', UID], { files: { 'c.json': fixtureFile(contractOf({ names: ['AAPL', 'MSFT'] })) }, nowIso: etIso(S[0], 10, 30) });
    expect(r.body.priceList.snapshotKey).toBe(`${S[0]}_open30`);
    expect(r.body.priceList.symbols).toEqual([
      { symbol: 'AAPL', priced: true, price: 231.47 },
      { symbol: 'MSFT', priced: false, price: null },
      { symbol: 'SPY', priced: true, price: 597.31 },
    ]);
    expect((await cli(db, ['admit', '--file', 'c.json', '--dry-run', '--uid', UID], { files: { 'c.json': fixtureFile(contractOf({ names: ['AAPL', 'MSFT'] })) }, nowIso: etIso(S[0], 10, 30) })).out).toContain('MSFT   NOT PRICED — entry needs a price');
  });

  it('the read-only view: its references have no write method, and a reference from outside it is refused', async () => {
    const caught = [];
    const view = readOnlyView(makeMandateFakeDb(), caught);
    const ref = view.collection('mandates').doc('b').collection('ideas').doc('i');
    expect(Object.keys(ref).sort()).toEqual(['collection', 'get', 'id', 'path']);
    expect(Object.keys(view).sort()).toEqual(['collection', 'runTransaction']);
    await view.runTransaction(async (tx) => {
      tx.set(ref, { a: 1 });
      expect(() => tx.get(makeMandateFakeDb().collection('mandates').doc('b'))).toThrow(/outside the read-only view/);
    });
    expect(caught).toEqual([{ op: 'set', path: 'mandates/b/ideas/i', fields: ['a'] }]);
  });
});

// ── STATUS ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('status — read-only', () => {
  it('no open book: the gates, the lists, and "none open"; nothing written', async () => {
    const db = makeMandateFakeDb(agents());
    const r = await cli(db, ['status', '--uid', UID]);
    expect(r.code).toBe(EXIT.DONE);
    expect(r.out).toContain('mode            on');
    expect(r.out).toContain('founder list    yes');
    expect(r.out).toContain('book            none open for this uid');
    expect(dumpStore(db)).toBe(dumpStore(makeMandateFakeDb(agents())));
  });

  it('a book with an entered and closed idea: state, cash, slots, names, lines, sessions left; the parse report of the book\'s own symbols', async () => {
    const { db, bookId, ideaId } = await founderBook({ contract: contractOf({ names: ['AAPL', 'MSFT'] }) });
    await enterAt(db, bookId, ideaId, { date: DAYS.d1, quotes: QUOTES });
    await closeOn(db, bookId, DAYS.d1, QUOTES);
    const evening = new Date(closeNowOf(DAYS.d1).getTime() + 3600_000).toISOString();
    const before = dumpStore(db);
    const r = await json(db, ['status', '--uid', UID], { nowIso: evening });
    expect(dumpStore(db)).toBe(before);
    expect(r.code).toBe(EXIT.DONE);
    const book = r.body.book;
    expect(book).toMatchObject({ bookId, status: 'active', drafting: 'on', lastClosedSession: DAYS.d1, slots: { medium: null, long: null } });
    expect(book.slots.short).toMatchObject({ ideaId, status: 'holding', names: ['AAPL', 'MSFT'], dueSession: getIdea(db, bookId, ideaId).contract.schedule.dueSession });
    expect(book.slots.short.lines.map((l) => [l.symbol, l.entered, typeof l.level])).toEqual([['AAPL', true, 'number'], ['MSFT', true, 'number']]);
    expect(book.slots.short.sessionsLeft).toBe(sessionsLeft(DAYS.d1, book.slots.short.dueSession));
    expect(r.body.records).toEqual([]);
    expect(r.body.parseReport).toMatchObject({ session: DAYS.d1, alerts: [] });
    // A rejection for a book symbol is an alert; one for a symbol the book does not hold is not printed.
    storeParseReport(db, DAYS.d1, 'MSFT', { ...structuredClone(CLEAN_PARSE_ENTRY), rowsRejected: 1, rejects: [{ leg: 'splits', reason: 'bad', row: { date: DAYS.d1 } }] });
    storeParseReport(db, DAYS.d1, 'TSLA', { ...structuredClone(CLEAN_PARSE_ENTRY), rowsRejected: 1, rejects: [{ leg: 'splits', reason: 'bad', row: {} }] });
    const again = await json(db, ['status', '--uid', UID], { nowIso: evening });
    expect(again.body.parseReport.alerts).toEqual([{ session: DAYS.d1, symbol: 'MSFT', reason: 'parse_rejected' }]);
    const text = await cli(db, ['status', '--uid', UID], { nowIso: evening });
    expect(text.out).toContain('  MSFT  parse_rejected');
    expect(text.out).not.toContain('TSLA');
    expect(text.out).toMatch(/lines {7}AAPL line \$[\d,.]+ \(5% below entry\); MSFT line/);
  });

  it('prints no other user\'s ids — not the registry\'s, not another book\'s — in text or JSON', async () => {
    const db = makeMandateFakeDb({ ...agents(), ...agents(OTHER) });
    const other = await createIdeaBook(db, { uid: OTHER, attributionAgentId: `agent-${OTHER}`, archetypeCodeId: 'degen', opId: 'other-create', nowIso: ADMIT_ISO });
    const otherIdea = await admitIdea(db, { bookId: other.bookId, contract: contractOf(), opId: 'other-idea', nowIso: ADMIT_ISO });
    expect(otherIdea.ok).toBe(true);
    await founderBook({ db, contract: contractOf({ names: ['MSFT'] }) });
    expect(Object.values(db._get('practiceFieldBooks/_registry').openBooks)).toContain(OTHER);
    for (const args of [['status', '--uid', UID], ['status', '--uid', UID, '--json']]) {
      const r = await cli(db, args);
      expect(r.code).toBe(EXIT.DONE);
      for (const foreign of [OTHER, other.bookId, otherIdea.ideaId, `agent-${OTHER}`]) expect(r.out, `${args} ${foreign}`).not.toContain(foreign);
    }
  });

  it('build B2: the latest close row\'s agent check — each desk\'s note under its name, its actions and reasons, the drafts considered — and this month\'s spend against the bound', async () => {
    const { setPracticeFieldAgentForTests } = await import('../api/_utils/practiceField/mode.js');
    const { runIdeaBookAgentPass } = await import('../api/_utils/practiceField/agentRun.js');
    const { fakeTransport, toolResponse, holdAll, draft, agentNowOf } = await import('../api/_utils/practiceField/__testsupport__/agentFixtures.js');
    const restoreAgent = setPracticeFieldAgentForTests({ agent: true, theses: false });
    try {
      const { db, bookId, ideaId } = await founderBook({ contract: contractOf({ names: ['AAPL', 'MSFT'] }) });
      await enterAt(db, bookId, ideaId, { date: DAYS.d1, quotes: QUOTES });
      await closeOn(db, bookId, DAYS.d1, QUOTES);
      const fake = fakeTransport(({ desk, request }) => toolResponse(holdAll(request, {
        note: `${desk} says hold`, drafts: desk === 'shadow' ? [draft({ slot: 'long', names: ['NVDA'] }), draft({ slot: 'medium', names: ['TSLA'] })] : [],
      })));
      await runIdeaBookAgentPass(db, { date: DAYS.d1, now: agentNowOf(DAYS.d1), ownerToken: 't', transport: fake.transport, clock: () => agentNowOf(DAYS.d1) });
      const evening = new Date(closeNowOf(DAYS.d1).getTime() + 3600_000).toISOString();
      const before = dumpStore(db);
      const r = await json(db, ['status', '--uid', UID], { nowIso: evening });
      expect(dumpStore(db)).toBe(before);
      expect(r.body.agent).toMatchObject({ enabled: true, thesesEnabled: false, session: DAYS.d1 });
      expect(r.body.agent.desks.shadow).toMatchObject({ name: 'The Shadow desk', source: 'model', note: 'shadow says hold', calls: 1, actions: [] });
      expect(r.body.agent.desks.shadow.considered.map((c) => [c.index, c.outcome, c.refusals])).toEqual([[0, 'admitted', []], [1, 'refused', ['name_not_a_candidate']]]);
      expect(r.body.agent.desks.archetype).toMatchObject({ name: 'The archetype desk', source: 'model', note: 'archetype says hold' });
      expect(r.body.agent.desks.archetype.actions).toEqual([{ ideaId, action: 'hold', reason: 'The thesis still holds against its comparison.', outcome: 'held' }]);
      expect(r.body.spend).toMatchObject({ month: '2026-11', boundUsd: 3, calls: 2, exhausted: false });
      expect(r.body.spend.settledUsd).toBeGreaterThan(0);
      const text = await cli(db, ['status', '--uid', UID], { nowIso: evening });
      expect(text.out).toMatch(/agent {11}on in this checkout \(saved theses off\) {3}latest check: 2026-11-16/);
      expect(text.out).toContain('  The Shadow desk   model');
      expect(text.out).toContain('    note        "shadow says hold"');
      expect(text.out).toMatch(/ {4}action {6}idea_[0-9a-f]+ {2}hold → held/);
      expect(text.out).toMatch(/ {4}draft 0 {5}long {2}NVDA {2}\(price_list\) {2}ADMITTED idea_[0-9a-f]+ at \$[\d,.]+/);
      expect(text.out).toContain('    draft 1     medium  TSLA  (price_list)  refused: name_not_a_candidate');
      expect(text.out).toMatch(/spend {11}2026-11: \$[\d.]+ charged, \$[\d.]+ committed of \$3\.00 {3}2 call\(s\)/);
    } finally { restoreAgent(); }
  });

  it('sessionsLeft: trading sessions from today through the due session, both counted; 0 once it has passed', () => {
    expect(sessionsLeft('2026-11-16', '2026-11-16')).toBe(1);
    expect(sessionsLeft('2026-11-16', '2026-11-20')).toBe(5);
    expect(sessionsLeft('2026-11-14', '2026-11-17')).toBe(2); // a Saturday: Monday and Tuesday
    expect(sessionsLeft('2026-11-25', '2026-11-30')).toBe(3); // Thanksgiving Thursday is no session: 25, 27, 30
    expect(sessionsLeft('2026-11-21', '2026-11-20')).toBe(0);
    expect(sessionsLeft('2026-11-21', null)).toBeNull();
  });
});

// ── THE RECORDS STATUS LISTS ARE THE DOOR'S ─────────────────────────────────────────────────────────────────────────────

describe('the records status lists are the door\'s own records (over the corporate-action sequence harness)', () => {
  installSequenceHooks();
  /** A decision every kind's planner accepts for an open record (holdRulings.js DECISIONS). */
  const LENIENT = { suspicion: 'price_move', conflict: 'none', coverage_gap: 'no_action', late_adjustment: 'decline' };
  const NOT_FOUND = new Set(['record_not_found', 'kind_invalid', 'record_id_invalid', 'decision_invalid']);

  it('every record listed, on every idea state of every history, is found by the door\'s planner; a ruled one answers already resolved — every kind reached', async () => {
    const reached = { suspicion: 0, conflict: 0, coverage_gap: 0, late_adjustment: 0, ruled: 0 };
    const reasons = new Set();
    const check = (idea, label) => {
      for (const r of openRecordsOf(idea)) {
        const plan = planHoldRuling(idea, { kind: r.kind, recordId: r.recordId, decision: LENIENT[r.kind] }, { uid: 'owner-1', requestKey: 'probe', nowIso: ADMIT_ISO });
        if (r.ruled) {
          reached.ruled += 1;
          expect(plan.error, `${label} ${r.kind} ${r.recordId} (ruled)`).toBe('record_already_resolved');
        } else {
          reached[r.kind] += 1;
          reasons.add(r.kind === 'conflict' ? String(r.reason).replace(/^refused: .*/, 'refused') : r.kind === 'coverage_gap' ? (r.recordId.startsWith('ca_closed_doubt_') ? 'closed_doubt' : 'open_gap') : r.kind);
          expect(NOT_FOUND.has(plan.error) || plan.error === 'record_already_resolved', `${label} ${r.kind} ${r.recordId}: ${plan.error}`).toBe(false);
        }
      }
    };
    const watch = (plan) => ({ ...plan, steps: plan.steps.flatMap((s, n) => [s, { kind: 'expectIdea', fn: (idea, _book, label) => check(idea, `${plan.seed} step ${n} ${label}`) }]) });
    // (A-5's refused share-basis record — a 1-for-a-billion reverse split rounds the holding to nothing — as astraConfirmation.test.js C05 makes it.)
    const refusedSplit = parseSplitsPayload('AAPL', [{ date: SEQ[2], split: '1/1000000000' }]).actions[0];
    const refusedPlan = { seed: 'b0-refused-share-basis', steps: [{ kind: 'close', i: 0, price: 100, rows: [] }, { kind: 'close', i: 1, price: 94, rows: [] }, { kind: 'close', i: 2, price: 94, rows: [refusedSplit] }, { kind: 'close', i: 3, price: 94, rows: [] }] };
    const plans = [refusedPlan, ...FIXED, ...FIXED_LATE, ...ASTRA_T2E, ...Array.from({ length: 8 }, (_, i) => generateWide(9100 + i)), ...Array.from({ length: 8 }, (_, i) => generateLate(9300 + i)),
      // (`ahead` histories carry a sold holding's coverage doubt — closedCoverageDoubts, A-4.)
      ...Array.from({ length: 8 }, (_, i) => generateLate(9500 + i, { ahead: true }))];
    for (const plan of plans) await runSequence(watch(plan));
    console.info(`[practice-field-founder] records reached: ${JSON.stringify(reached)}; record reasons: ${[...reasons].sort().join(', ')}`);
    expect(reached, JSON.stringify(reached)).toMatchObject({ suspicion: expect.any(Number) });
    for (const k of ['suspicion', 'conflict', 'coverage_gap', 'late_adjustment', 'ruled']) expect(reached[k], `${k} reached: ${JSON.stringify(reached)}`).toBeGreaterThan(0);
    for (const reason of ['conflicting_action', 'possible_redate', 'revised_after_ruling', 'refused', 'open_gap', 'closed_doubt']) expect(reasons.has(reason), `${reason} reached: ${[...reasons]}`).toBe(true);
  }, 120_000);

  it('a refused share-basis record whose id the ledger has settled since is not listed — the door does not find it either', () => {
    const recordId = `reverse_split_AAPL_${SEQ[2]}`;
    const held = { actionId: recordId, type: 'reverse_split', ticker: 'AAPL', effectiveDate: SEQ[2], ratio: 1e-9, refused: 'rounds_to_nothing', heldOn: SEQ[2] };
    const ideaWith = (declined) => ({ ideaId: 'idea-x', ledger: { holdings: { AAPL: { shares: 10, heldActions: [held] } }, declinedActionIds: declined } });
    expect(openRecordsOf(ideaWith([])).map((r) => [r.kind, r.recordId, r.reason])).toEqual([['conflict', recordId, 'refused: rounds_to_nothing']]);
    expect(planHoldRuling(ideaWith([]), { kind: 'conflict', recordId, decision: 'none' }, { uid: 'u', requestKey: 'k', nowIso: ADMIT_ISO }).error).toBeUndefined();
    expect(openRecordsOf(ideaWith([recordId]))).toEqual([]);
    expect(planHoldRuling(ideaWith([recordId]), { kind: 'conflict', recordId, decision: 'none' }, { uid: 'u', requestKey: 'k', nowIso: ADMIT_ISO }).error).toBe('record_not_found');
  });

  it('end to end: status on a history left with an open record lists it, and resolve --go with that id is recorded by the door', async () => {
    vi.stubEnv('MANDATE_FOUNDER_UIDS', 'owner-1');
    let done = false;
    for (const plan of [...FIXED, ...FIXED_LATE, ...Array.from({ length: 40 }, (_, i) => generateWide(9100 + i))]) {
      await runSequence(plan);
      const [db] = takeSeededDbs();
      const status = await json(db, ['status', '--uid', 'owner-1'], { nowIso: etIso('2026-12-31', 20, 0) });
      const open = (status.body.records || []).find((r) => !r.ruled && (r.kind === 'conflict' || r.kind === 'suspicion' || r.kind === 'coverage_gap' || r.kind === 'late_adjustment'));
      if (!open) continue;
      const ruling = { ideaId: open.ideaId, kind: open.kind, recordId: open.recordId, decision: LENIENT[open.kind] };
      const r = await json(db, ['resolve', '--file', 'r.json', '--uid', 'owner-1', '--go'], { files: { 'r.json': JSON.stringify(ruling) }, nowIso: etIso('2026-12-31', 20, 0) });
      expect(NOT_FOUND.has(r.body.answer.error), `${plan.seed}: ${JSON.stringify(r.body.answer)}`).toBe(false);
      if (r.body.answer.ok) {
        expect(r.code).toBe(EXIT.DONE);
        const book = (await json(db, ['status', '--uid', 'owner-1'], { nowIso: etIso('2026-12-31', 20, 0) })).body;
        expect(book.records.find((x) => x.recordId === open.recordId)?.ruled, plan.seed).toBe(true);
        done = true;
        break;
      }
    }
    expect(done, 'no history left an open record the door would rule on').toBe(true);
  }, 120_000);
});

// ── THE EXAMPLES ────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('the shipped examples', () => {
  it('the directory holds the idea and one ruling per kind', () => {
    expect(readdirSync(EXAMPLES_DIR).sort()).toEqual([
      'medium-idea.example.json', 'resolve-conflict.example.json', 'resolve-coverage-gap.example.json', 'resolve-late-adjustment.example.json', 'resolve-suspicion.example.json',
    ]);
  });

  it('the medium idea is valid under the contract: two or three large names, a sector-fund comparison, inside the medium band', () => {
    const contract = parseRequestText(exampleText('medium-idea.example.json'));
    const { contract: normalized, refusals } = normalizeIdeaContract(contract);
    expect(refusals).toEqual([]);
    expect(normalized).toMatchObject({ slot: 'medium', comparison: { type: 'sector_fund', symbols: ['XLF'] }, origin: { kind: 'founder_fixture', initiatedBy: 'agent' } });
    expect(normalized.names.length).toBeGreaterThanOrEqual(2);
    expect(normalized.names.length).toBeLessThanOrEqual(3);
    expect(contract.capitalUsd).toBeLessThanOrEqual(30000);
  });

  it.each(['late_adjustment', 'conflict', 'suspicion', 'coverage_gap'])('the %s ruling: shaped as the door reads it — its kind and decision pass the door\'s own checks', (kind) => {
    const file = `resolve-${kind.replace('_', '-')}.example.json`;
    const value = parseRequestText(exampleText(file));
    const body = bodyWithoutKey('resolve', { fileValue: value });
    expect(Object.keys(body).filter((k) => k !== 'action').every((k) => RESOLVE_FIELDS.includes(k))).toBe(true);
    expect(body).toMatchObject({ action: 'resolve_hold', kind, ideaId: expect.any(String), recordId: expect.any(String), decision: expect.any(String) });
    expect(HOLD_KINDS).toContain(kind);
    // The door's planner on an idea without the record: past its field checks (kind, id, decision, ratio) to "not found".
    expect(planHoldRuling({ ideaId: 'x' }, body, { uid: UID, requestKey: 'k', nowIso: ADMIT_ISO })).toEqual({ error: 'record_not_found', status: 404 });
  });

  it('each kind\'s decisions as status prints them are the door\'s: every one passes its check, another is refused', () => {
    expect(Object.keys(DECISIONS_OF).sort()).toEqual([...HOLD_KINDS].sort());
    for (const [kind, decisions] of Object.entries(DECISIONS_OF)) {
      for (const decision of decisions) expect(planHoldRuling({}, { kind, recordId: 'r', decision }, { uid: UID, requestKey: 'k', nowIso: ADMIT_ISO }).error, `${kind} ${decision}`).not.toBe('decision_invalid');
      expect(planHoldRuling({}, { kind, recordId: 'r', decision: 'bogus' }, { uid: UID, requestKey: 'k', nowIso: ADMIT_ISO }).error).toBe('decision_invalid');
    }
  });
});

// ── THE SCRIPT WRITES NOTHING ITSELF ────────────────────────────────────────────────────────────────────────────────────

describe('the script\'s source', () => {
  const source = readFileSync(SCRIPT_PATH, 'utf8');
  const code = source.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

  it('makes no write call of its own: every write is the door\'s, through ONE call of runFounderAction', () => {
    for (const write of [/\.set\(/, /\.update\(/, /\.create\(/, /\.delete\(/, /\.batch\(/, /\.runTransaction\(/, /\.add\(/, /bulkWriter/, /recursiveDelete/]) {
      expect(code.match(write), String(write)).toBeNull();
    }
    expect(code.match(/runFounderAction\(/g)).toHaveLength(1);
  });

  it('loads credentials only in productionDb, reached only from the direct run', () => {
    expect(code.match(/loadLocalEnv/g)).toHaveLength(1);
    expect(code.match(/firebaseAdmin/g)).toHaveLength(1);
    expect(code).not.toMatch(/^import .*(loadLocalEnv|firebaseAdmin)/m);
    expect(code).not.toMatch(/process\.env/);
  });

  it('has no shebang (an importer on a Windows checkout must load it)', () => {
    expect(source.startsWith('#!')).toBe(false);
  });
});
