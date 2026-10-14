// scripts/census-film-room-b1.test.js
//
// Film Room B1 — the read-only census (build prompt §2). Importing the module
// runs nothing and reads no credential (main() is guarded behind the CLI
// entrypoint); that passing load is the BUILD_RULES §4 dependency-surface guard
// for the script. The core runs here on fixture days the REAL close pass wrote.

import { describe, it, expect, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
vi.mock('../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { WRITE_PATTERN, GATED_FILES, writeCallsIn, computeB1Census, renderB1Census, tapeIdsOf, parseArgs, censusErrorLine, CENSUS_ERROR_MAX } from './census-film-room-b1.mjs';
import { writeTapeDay } from '../api/_utils/filmTape/writeTapeDay.js';
import { makeTapeDb } from '../api/_utils/filmTape/__fixtures__/tapeFirestore.js';
import { seedDay } from '../api/_utils/filmTape/__fixtures__/tapeFixtures.js';
import { stalledDay } from '../api/_utils/filmTape/__fixtures__/tagFixtures.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const nightOf = (d) => Date.parse(`${d}T02:15:30.000Z`) + 86_400_000;

/** A fixture day through the real close pass: the stored tape, as Firestore would hand it to the census. */
async function written(fx) {
  const t = makeTapeDb(seedDay({}, fx));
  await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: nightOf(fx.etDate) });
  const path = `agentBattles/${fx.battleId}/tape/${fx.etDate}`;
  return { path, data: JSON.parse(JSON.stringify(t.store.get(path))) };
}
const NOW = Date.parse('2026-10-14T12:00:00.000Z');

describe('the write-grep gate (the Practice Field discovery\'s §0.2 grep)', () => {
  it('the pattern is the discovery\'s: it bites every write form and no read form', () => {
    for (const w of ['ref.set({})', 'ref.update ({})', 'col.add(x)', 'ref.delete()', 'ref.create({})', 'db.run' + 'Transaction(f)', 'db.batch()', 'db.bulk' + 'Writer()', 'write' + 'Batch(db)', 'Field' + 'Value.increment(1)', 'db.recursive' + 'Delete(ref)']) {
      expect(WRITE_PATTERN.test(w), w).toBe(true);
    }
    for (const r of ['ref.get()', 'db.getAll(...refs, { fieldMask })', 'q.where(a, b, c)', 'q.select(f)', 'db.collectionGroup(t)', 'col.doc(id)', 'writeFileSync(p, s)']) {
      expect(WRITE_PATTERN.test(r), r).toBe(false);
    }
  });

  it('the census script and the tagger it runs carry no write call — the gate the script runs before anything else', () => {
    expect(GATED_FILES).toEqual(['scripts/census-film-room-b1.mjs', 'api/_utils/filmTape/tapeTags.js']);
    for (const rel of GATED_FILES) expect(writeCallsIn(readFileSync(resolve(REPO, rel), 'utf8')), rel).toEqual([]);
  });

  it('a planted write call trips it, with its line', () => {
    const src = readFileSync(resolve(REPO, GATED_FILES[0]), 'utf8');
    const planted = src.replace('const tapeSnap = await db.collectionGroup(\'tape\').get();', 'const tapeSnap = await db.collectionGroup(\'tape\').get(); await tapeSnap.docs[0].ref.update({ x: 1 });');
    expect(planted).not.toBe(src);
    const hits = writeCallsIn(planted);
    expect(hits).toHaveLength(1);
    expect(hits[0][1]).toMatch(/ref\.update\(/);
  });

  it('main() checks the gate before it reads a credential or Firestore', () => {
    const src = readFileSync(resolve(REPO, GATED_FILES[0]), 'utf8');
    const main = src.slice(src.indexOf('async function main()'));
    expect(main.indexOf('writeCallsIn(')).toBeGreaterThan(-1);
    expect(main.indexOf('writeCallsIn(')).toBeLessThan(main.indexOf('loadEnv()'));
    expect(main.indexOf('loadEnv()')).toBeLessThan(main.indexOf('getFirestore('));
  });
});

describe('the core over days the real close pass wrote', () => {
  let r;
  let rendered;
  const ids = [];
  it('builds', async () => {
    const tapes = [];
    const battles = {};
    const add = async (fx, edit = null) => {
      const t = await written(fx);
      if (edit) edit(t.data);
      tapes.push(t);
      battles[fx.battleId] = battles[fx.battleId] ?? fx.battle;
      ids.push(fx.battleId);
    };
    // preceded
    await add(await stalledDay({ battleId: 'b-pre' }));
    // a no-trigger check before the exit: no_price_pause
    await add(await stalledDay({ battleId: 'b-pause', noTriggerSeqs: [3] }));
    // the registry does not know the archetype: tagger_unavailable
    await add(await stalledDay({ battleId: 'b-unknown', archetype: 'speculator' }));
    // the winner test: an NVDA stagnation exit planted on the stored day (NVDA never moves but is up from entry)
    await add(await stalledDay({ battleId: 'b-winner', exitSeq: null }), (tape) => {
      tape.actions.push({ key: 'swap:nvda', at: tape.checks[9].at.replace(':20.', ':10.'), symbolOut: 'NVDA', symbolIn: 'XOM', exitReason: 'stagnation', tickSeq: 10 });
    });
    // the overnight carry: day 1 ends with ACN's count high; day 2's rule fires at its second check
    const d1 = await stalledDay({ battleId: 'b-ovn', exitSeq: null, etDate: '2026-09-24' });
    const d2 = await stalledDay({ battleId: 'b-ovn', exitSeq: 2, etDate: '2026-09-25' });
    battles['b-ovn'] = { ...d2.battle, timing: { tradingDays: ['2026-09-24', '2026-09-25'] } };
    tapes.push(await written(d1), await written(d2));
    ids.push('b-ovn');
    // acceptance A's day, the exit at 15:00 ET (check 23)
    await add(await stalledDay({ battleId: 'b-oct9', etDate: '2026-10-09', exitSeq: 23 }));
    // T1: no opponent
    await add(await stalledDay({ battleId: 'b-noopp', opponent: null, exitSeq: null }));
    // T2: a rejected meeting naming ORCL; W2: a timeline with an entry that is not a date
    await add(await stalledDay({
      battleId: 'b-meet', exitSeq: null,
      over: {
        timing: { tradingDays: ['not-a-date', '2026-09-24'] },
        portfolio: { star: [{ symbol: 'ACN' }, { symbol: 'MSFT' }], core: [], support: [], bench: { stocks: [{ symbol: 'ORCL' }, { symbol: 'NVDA' }], crypto: null } },
        gameplanMeetingHistory: [{ id: 'gpm_x', createdAt: '2026-09-24T15:10:00.000Z', status: 'rejected', resolvedAt: '2026-09-24T15:20:00.000Z', resolvedBy: 'coach', diagnosis: 'w', suggestedSwaps: [{ symbolOut: 'ACN', symbolIn: 'ORCL' }] },
          { id: 'gpm_y', createdAt: '2026-09-24T19:30:00.000Z', status: 'expired', resolvedAt: '2026-09-25T13:30:20.000Z', resolvedBy: 'system', diagnosis: 'w', suggestedSwaps: [{ symbolOut: 'MSFT', symbolIn: 'NVDA' }, { symbolOut: 'BEST', symbolIn: 'NVDA' }] }],
      },
    }));
    // W1 and W4: a closed-out day still saying a candle pass is coming, in the pre-W4 wording
    await add(await stalledDay({ battleId: 'b-old', exitSeq: null }), (tape) => {
      tape.passes.candles.status = 'expired';
      tape.coverage.checks.caveats = ['1 minted check(s) of this day have no record (tickSeq 9)'];
    });
    r = computeB1Census({ tapes, battles, ticks: {}, dialEnabled: true, nowMs: NOW, acceptanceA: { etDate: '2026-10-09', symbol: 'ACN', etClock: '15:00' } });
    rendered = renderB1Census(r);
    expect(r.tapes.writtenTiered).toBe(10);
  });

  it('B: every recorded stagnation exit counted; each mismatch classed — preceded, no-price pause, winner basis, overnight carry, tagger unavailable', () => {
    expect(r.B).toMatchObject({ exits: 6, preceded: 2, notPreceded: 3, unknown: 1 });
    expect(r.B.mismatchClass).toEqual({ no_price_pause: 1, winner_basis: 1, count_carried_overnight: 1, tagger_unavailable: 1 });
    expect(r.B.preceded + r.B.notPreceded + r.B.unknown).toBe(r.B.exits);
  });

  it('A: the day\'s ACN exit at the named time, preceded — with its tags and its walk', () => {
    expect(r.A.verdict).toBe('PASS');
    expect(r.A.exitsFound).toHaveLength(1);
    expect(r.A.exitsFound[0]).toMatchObject({ exitAt: '15:00', precededByTag: true });
    expect(r.A.exitsFound[0].items.map((i) => i.count)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
  });

  it('the evidence stamp per check state: no_trigger checks carry none', () => {
    expect(r.evidence.byState.no_trigger).toEqual({ checks: 1, withEvidence: 0, withHeldPx: 0, heldWithoutPx: 1 });
    expect(r.evidence.byState.completed.withHeldPx).toBe(r.evidence.byState.completed.checks);
  });

  it('T1, T2, W1, W2, W4 — the counts the report needs', () => {
    expect(r.T1.tieredNoOpponent).toBe(1);
    expect(r.T2).toMatchObject({ meetings: 2, byStatus: { rejected: 1, expired: 1 }, legs: 3, tapesWithNewSymbols: 1, newSymbolsPerTape: 1, newSymbolDayPairs: 1 });
    expect(r.T2.offRosterSymbols).toBe(1);                         // review RF-1: the planted BEST, counted and never added
    expect(r.T2.filedLaterDay).toEqual({ expired: 1 });
    expect(r.W1.terminalWithAwaitingNote).toBe(1);
    expect(r.W2).toEqual({ battlesWithDroppedEntries: 1, ofThemTaped: 1 });
    expect(r.W4.tapesWithOldWording).toBe(1);
    expect(r.tags.unknownArchetypes).toEqual({ speculator: 1 });
  });

  it('counts only: no battle or owner id in the rendered census or its JSON', () => {
    const json = JSON.stringify(r);
    for (const id of [...new Set(ids), 'owner-1', 'agent-1']) {
      expect(rendered.includes(id), id).toBe(false);
      expect(json.includes(id), id).toBe(false);
    }
    expect(rendered).toMatch(/battle #1/);
  });
});

describe('the small parts', () => {
  it('a tape path, and nothing else, gives ids; --json takes its path', () => {
    expect(tapeIdsOf('agentBattles/b1/tape/2026-09-24')).toEqual({ battleId: 'b1', etDate: '2026-09-24' });
    for (const p of ['agentBattles/b1/tape/2026-09-24/series/ACN', 'other/b1/tape/2026-09-24', 'agentBattles/b1/tape/24-09-2026']) expect(tapeIdsOf(p), p).toBeNull();
    expect(parseArgs(['--json', 'out.json'])).toEqual({ json: 'out.json' });
    expect(parseArgs([])).toEqual({ json: null });
  });
});

describe('the CLI\'s own output — no ids, no key material (Astra\'s B1 review, backlog 1)', () => {
  const SRC = readFileSync(resolve(REPO, 'scripts/census-film-room-b1.mjs'), 'utf8');

  it('main() prints no project id: no console line names one, and the credential\'s values are registered never to be printed', () => {
    const consoleLines = SRC.split(/\r?\n/).filter((l) => /console\.(log|error|warn|info)\(/.test(l));
    expect(consoleLines.length).toBeGreaterThan(0);
    expect(consoleLines.filter((l) => /project_id|projectId|client_email|private_key/.test(l))).toEqual([]);
    expect(SRC).toMatch(/NEVER_PRINTED\.push\(\.\.\.\[sa\.project_id, sa\.client_email, sa\.private_key_id, sa\.client_id\]/);
  });

  it('the failure handler prints censusErrorLine, never the raw message', () => {
    expect(SRC).toMatch(/console\.error\(`\[census-b1\] failed: \$\{censusErrorLine\(err\)\}`\)/);
    expect(SRC).not.toMatch(/failed: \$\{String\(err/);
  });

  it('a failure line keeps the class and drops key blocks, the credential\'s values, addresses, resource paths and ids', () => {
    const err = new TypeError([
      'Could not load -----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC/x+y\n-----END PRIVATE KEY-----',
      'for svc-reader@demo-project.iam.gserviceaccount.com',
      'at projects/demo-project/databases/(default)/documents/agentBattles/AbCdEf1234567890XyZq/tape/2026-10-09;',
      'battle AbCdEf1234567890XyZq, owner Qw3rTy9UiOp4AsDfGh5JkLzXcV7b, agent ag3ntK1d;',
      'project tradesevenx; status PERMISSION_DENIED',
    ].join(' '));
    const line = censusErrorLine(err, { secrets: ['tradesevenx'] });
    expect(line.startsWith('TypeError: Could not load [key] for [address] at [path]')).toBe(true);
    for (const leak of ['BEGIN', 'MIIE', 'PRIVATE KEY', 'svc-reader', 'demo-project', 'agentBattles', 'AbCdEf1234567890XyZq', 'Qw3rTy9UiOp4AsDfGh5JkLzXcV7b', 'ag3ntK1d', 'tradesevenx']) {
      expect(line, leak).not.toContain(leak);
    }
    expect(line).toContain('PERMISSION_DENIED');                    // a status word is no id
    expect(line.length).toBeLessThanOrEqual(CENSUS_ERROR_MAX);
  });

  it('bounded, and safe on an unterminated key block, a thrown string, a planted class name and a throwing message', () => {
    expect(censusErrorLine(new Error('x '.repeat(5000))).length).toBe(CENSUS_ERROR_MAX);
    expect(censusErrorLine(new Error('bad -----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0'))).toBe('Error: bad [key]');
    expect(censusErrorLine('plain words')).toBe('Error: plain words');
    expect(censusErrorLine(Object.assign(new Error('m'), { name: 'agentBattles/b1 Qw3rTy9UiOp' }))).toBe('Error: m');
    expect(censusErrorLine({ get message() { throw new Error('no'); }, name: 'RangeError' })).toBe('RangeError');
  });
});
