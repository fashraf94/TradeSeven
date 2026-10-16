// api/_utils/filmTape/errorClass.test.js
//
// Film Room B1.1 item 5 — ONE SAFE ERROR-CLASS LIST (Amendment C, RC-4;
// Astra's B1 confirmation, N1). Every class the tape or the census prints comes
// from errorClass.js's fixed list; any other name prints `Error`.
//
// Astra's N1 repro — a registered value as the class (`FakeOwner31Error`) —
// on every surface: the T1 note, the meetings note, the tagger's failure note
// and the census's failure line. Controls: `TypeError` prints `TypeError`, and
// a listed SDK class, built from the INSTALLED package, prints its name.
//
// The real writer runs; three seams are mocked by spreading the real module
// and wrapping one export each (the B1 isolation suites' precedent): the tick
// read (an opponent accessor that throws), the meeting-history reader and the
// risk manager's counter (the tagger). DEPENDENCY-SURFACE GUARD: errorClass.js
// itself is imported unmocked.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';

const knobs = vi.hoisted(() => ({ site: null, err: null }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));
vi.mock('./tapeSources.js', async (importOriginal) => {
  const real = await importOriginal();
  const trapped = (s) => { const o = { ...s }; Object.defineProperty(o, 'opponent', { enumerable: true, get() { throw knobs.err; } }); return o; };
  return {
    ...real,
    readDayTicks: async (...a) => {
      const r = await real.readDayTicks(...a);
      if (knobs.site !== 'opponent' || !r.ok) return r;
      return { ...r, ticks: r.ticks.map((t) => (t.tickSeq === 3 ? { ...t, scores: trapped(t.scores) } : t)) };
    },
  };
});
vi.mock('../playerFieldReaders.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, historyListOf: (...a) => { if (knobs.site === 'meetings') throw knobs.err; return real.historyListOf(...a); } };
});
vi.mock('../agentRiskManager.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, updateStagnationCounter: (...a) => { if (knobs.site === 'tagger') throw knobs.err; return real.updateStagnationCounter(...a); } };
});

import { ERROR_CLASSES, errorClassOf } from './errorClass.js';
import { writeTapeDay } from './writeTapeDay.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay } from './__fixtures__/tapeFixtures.js';
import { stalledDay } from './__fixtures__/tagFixtures.js';
import { censusErrorLine, registerNeverPrinted } from '../../../scripts/census-film-room-b1.mjs';

const require = createRequire(import.meta.url);
/** A module file inside an installed package (resolved from its entry, so a package `exports` map cannot hide it). */
const fromPackage = (pkg, rel) => require(path.join(path.dirname(require.resolve(pkg)), rel));
const { FirebaseError, FirebaseAppError, FirebaseFirestoreError } = fromPackage('firebase-admin', 'utils/error.js');
const { GoogleError } = fromPackage('google-gax', 'googleError.js');
const { GaxiosError } = fromPackage('gaxios', 'common.js');

const NOW = Date.parse('2026-09-25T02:15:30.000Z');
afterEach(() => { knobs.site = null; knobs.err = null; });

/** Astra's N1 repro: a registered value (an id-shaped token) planted as the class — by name, and as a real class's own name. */
const REGISTERED = 'FakeOwner31Error';
const plantedByName = () => Object.assign(new Error('safe reason'), { name: REGISTERED });
const plantedByClass = () => { const C = { [REGISTERED]: class extends Error {} }[REGISTERED]; return new C('safe reason'); };

async function noteAt(site, err) {
  knobs.site = site; knobs.err = err;
  const fx = await stalledDay({ battleId: `b-cls-${site}` });
  const t = makeTapeDb(seedDay({}, fx));
  const r = await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW });
  expect(r.status).toBe('written');                                    // a failure is a note, never the write's
  const tape = t.store.get(`agentBattles/${fx.battleId}/tape/${fx.etDate}`);
  return { opponent: tape.score.opponentNote, meetings: tape.coverage.meetings.note, tagger: tape.coverage.tags.note }[site];
}
const NOTE = {
  opponent: (cls) => `the opponent's score could not be read at 1 check (${cls})`,
  meetings: (cls) => `the meetings could not be read (${cls})`,
  tagger: (cls) => `stalled unavailable: the tagger failed (${cls})`,
};

describe('the list — fixed, and every entry a real class in this tree\'s installed dependencies', () => {
  it('is exactly the ECMAScript built-ins and the Firebase, Firestore (gax) and auth-transport classes these paths raise', () => {
    expect([...ERROR_CLASSES]).toEqual([
      'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'EvalError', 'URIError', 'AggregateError',
      'FirebaseError', 'FirebaseAppError', 'FirebaseFirestoreError', 'GoogleError', 'GaxiosError',
    ]);
    expect(Object.isFrozen(ERROR_CLASSES)).toBe(true);
  });

  it('each entry names a constructor that exists where errorClass.js cites it', () => {
    const real = { FirebaseError, FirebaseAppError, FirebaseFirestoreError, GoogleError, GaxiosError };
    for (const name of ERROR_CLASSES) {
      const C = globalThis[name] ?? real[name];
      expect(typeof C, name).toBe('function');
      expect(C.name, name).toBe(name);
    }
  });
});

describe('errorClassOf', () => {
  it('a built-in prints its class; a plain Error prints Error', () => {
    expect(errorClassOf(new TypeError('x'))).toBe('TypeError');
    expect(errorClassOf(new RangeError('x'))).toBe('RangeError');
    expect(errorClassOf(new AggregateError([], 'x'))).toBe('AggregateError');
    expect(errorClassOf(new Error('x'))).toBe('Error');
  });

  it('a listed SDK class, built from the installed package, prints its name (each sets no `name`, so its constructor is read)', () => {
    const app = new FirebaseAppError('invalid-credential', 'no key');
    expect(app.name).toBe('Error');
    expect(errorClassOf(app)).toBe('FirebaseAppError');
    expect(errorClassOf(new GoogleError('UNAVAILABLE'))).toBe('GoogleError');
    expect(errorClassOf(new GaxiosError('token', { url: new URL('https://example.invalid') }, undefined))).toBe('GaxiosError');
    // the Admin SDK's base constructor resets the prototype to its own (lib/utils/error.js:38): a Firestore error reports the base
    expect(errorClassOf(new FirebaseFirestoreError({ code: 'invalid-argument', message: 'x' }))).toBe('FirebaseError');
  });

  it('N1: a class-shaped name that is not a real class prints Error — by name or by constructor, any …Error / …Exception', () => {
    expect(errorClassOf(plantedByName())).toBe('Error');
    expect(errorClassOf(plantedByClass())).toBe('Error');
    for (const n of ['CustomError', 'OwnerABCdef1234Error', 'uid9fA3kQ7Error', 'XException', 'Error2', 'typeError', 'TypeErrorX']) {
      expect(errorClassOf(Object.assign(new Error('x'), { name: n })), n).toBe('Error');
    }
  });

  it('never throws: a throwing getter, a non-object, nothing at all — Error', () => {
    const hostile = {};
    Object.defineProperty(hostile, 'name', { get() { throw new Error('boom'); } });
    Object.defineProperty(hostile, 'constructor', { get() { throw new Error('boom'); } });
    for (const v of [hostile, null, undefined, 'TypeError', 42, Symbol('s')]) expect(errorClassOf(v)).toBe('Error');
  });
});

describe('every surface the tape prints a class on — the real writer, the error thrown at its own seam', () => {
  it.each(['opponent', 'meetings', 'tagger'])('%s: the N1 repro prints Error (by name and by class); TypeError prints TypeError; a listed SDK class prints its name', async (site) => {
    expect(await noteAt(site, plantedByName())).toBe(NOTE[site]('Error'));
    expect(await noteAt(site, plantedByClass())).toBe(NOTE[site]('Error'));
    expect(await noteAt(site, new TypeError('planted'))).toBe(NOTE[site]('TypeError'));
    expect(await noteAt(site, new FirebaseAppError('invalid-credential', 'x'))).toBe(NOTE[site]('FirebaseAppError'));
  });

  it('the registered value reaches no stored byte of the tape', async () => {
    for (const site of ['opponent', 'meetings', 'tagger']) {
      knobs.site = site; knobs.err = plantedByName();
      const fx = await stalledDay({ battleId: `b-cls-bytes-${site}` });
      const t = makeTapeDb(seedDay({}, fx));
      await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW });
      expect(JSON.stringify(t.store.get(`agentBattles/${fx.battleId}/tape/${fx.etDate}`)), site).not.toContain(REGISTERED);
    }
  });
});

describe('the census\'s failure line', () => {
  it('Astra\'s N1 repro, exactly: a registered value as the class prints Error — the message still sanitized', () => {
    registerNeverPrinted([REGISTERED]);
    expect(censusErrorLine({ name: REGISTERED, message: 'safe reason' })).toBe('Error: safe reason');
    expect(censusErrorLine(plantedByClass())).toBe('Error: safe reason');
    // the control Astra ran: the same token in a TypeError's message is redacted
    expect(censusErrorLine(new TypeError(`about ${REGISTERED}`))).toBe('TypeError: about [redacted]');
  });

  it('TypeError prints TypeError; a listed SDK class prints its name', () => {
    expect(censusErrorLine(new TypeError('bad input'))).toBe('TypeError: bad input');
    expect(censusErrorLine(new FirebaseAppError('invalid-credential', 'no key'))).toBe('FirebaseAppError: no key');
    expect(censusErrorLine(new GoogleError('unavailable'))).toBe('GoogleError: unavailable');
  });
});
