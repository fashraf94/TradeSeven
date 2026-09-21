// scripts/export-tick-capture.test.js
//
// The export runner, against DOUBLES. Importing the module runs nothing: main()
// is guarded behind the CLI entrypoint (the ws1-observe-walk.js precedent), so
// no admin SDK, no credentials and no network are touched — and that passing
// load is itself the BUILD_RULES §4 dependency-surface guard for this script.
//
// The rows that matter: it writes NOTHING to Firestore, its JSONL is one
// record per line, its coverage denominator is a whole battle's counter even
// when the OUTPUT is windowed, and an expired body exports as `body: null`.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  buildBattleInput, defaultOutPath, inWindow, parseArgs, parseEnvFile, rangeBounds, runExport, usage,
} from './export-tick-capture.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(HERE, 'export-tick-capture.js'), 'utf8');

const permanent = (seq, over = {}) => ({
  tickId: `b1:${seq}`, battleId: 'b1', tickSeq: seq,
  capturedAt: `2026-09-0${seq}T15:00:00.000Z`,
  model: { dispatched: true },
  body: { status: 'written' },
  ...over,
});

/** A read-only double: it has no write method to call, which is the point. */
function makeReader({ battles }) {
  const reads = [];
  return {
    reads,
    async readBattle(id) { reads.push(['battle', id]); return battles[id] ? { mintedTickSeq: battles[id].minted } : null; },
    async readTicks(id) { reads.push(['ticks', id]); return battles[id]?.ticks ?? []; },
    async readBodyIds(id) { reads.push(['bodyIds', id]); return battles[id]?.bodyIds ?? []; },
    async readBody(id, tickId) { reads.push(['body', id, tickId]); return { tickId, request: { body: '{}' } }; },
    async findBattleIds() { reads.push(['find']); return Object.keys(battles); },
  };
}

describe('READ-ONLY by construction', () => {
  it('the source contains no Firestore write call at all', () => {
    for (const forbidden of ['.set(', '.update(', '.create(', '.delete(', '.batch(', 'FieldValue']) {
      expect(SOURCE.includes(forbidden), `export script must not contain ${forbidden}`).toBe(false);
    }
  });

  it('it reads only through the injected reader, which exposes no writer', () => {
    const reader = makeReader({ battles: {} });
    expect(Object.keys(reader).filter((k) => k !== 'reads').every((k) => k.startsWith('read') || k === 'findBattleIds')).toBe(true);
  });

  it('main() is behind the CLI entrypoint — importing this module did nothing', () => {
    expect(SOURCE).toContain("if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename))");
  });
});

describe('argument parsing and the window', () => {
  it('parses every flag, and the bare invocation asks for help', () => {
    expect(parseArgs(['node', 's', '--battle', 'b1', '--out', 'x.jsonl', '--json'])).toMatchObject({ battle: 'b1', out: 'x.jsonl', json: true });
    expect(parseArgs(['node', 's', '--from', '2026-09-01', '--to', '2026-09-30'])).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    expect(parseArgs(['node', 's', '--resolve-unknown', '41,42, 43']).resolveUnknown).toEqual([41, 42, 43]);
    expect(usage()).toContain('Writes NOTHING to Firestore');
  });

  it('`--to` covers its WHOLE day, so a tick at 23:59 is inside the range', () => {
    const bounds = rangeBounds({ from: '2026-09-01', to: '2026-09-02' });
    expect(inWindow('2026-09-02T23:59:00.000Z', bounds)).toBe(true);
    expect(inWindow('2026-09-03T00:00:00.000Z', bounds)).toBe(false);
    expect(inWindow('2026-08-31T23:59:59.999Z', bounds)).toBe(false);
    expect(inWindow(null, bounds)).toBe(false);
  });

  it('an open bound stays open', () => {
    expect(inWindow('1999-01-01T00:00:00.000Z', rangeBounds({ from: null, to: null }))).toBe(true);
  });

  it('the default output path is built with node:path, so it is correct on Windows too', () => {
    const p = defaultOutPath({ battle: 'b1' }, new Date('2026-09-21T12:00:00.000Z'));
    expect(p.endsWith('tick-capture-battle-b1-20260921120000.jsonl')).toBe(true);
    expect(p).not.toContain('//');
  });
});

describe('buildBattleInput — the coverage shape, from what was read', () => {
  it('marks a tick whose body document is absent as not present (the TTL case)', () => {
    const input = buildBattleInput({
      battleId: 'b1', mintedTickSeq: 2,
      permanentDocs: [permanent(1), permanent(2)],
      bodyIds: ['b1:1'],
    });
    expect(input.ticks).toEqual([
      { tickSeq: 1, dispatched: true, bodyStatus: 'written', bodyPresent: true },
      { tickSeq: 2, dispatched: true, bodyStatus: 'written', bodyPresent: false },
    ]);
  });

  it('a record with no body block defaults to `skipped`, never to `written`', () => {
    const input = buildBattleInput({ battleId: 'b1', mintedTickSeq: 1, permanentDocs: [{ tickId: 'b1:1', tickSeq: 1 }], bodyIds: [] });
    expect(input.ticks[0]).toMatchObject({ bodyStatus: 'skipped', dispatched: false });
  });
});

describe('runExport', () => {
  it('one battle: a JSONL line per record, with its body, and exact coverage', async () => {
    const reader = makeReader({ battles: { b1: { minted: 3, ticks: [permanent(1), permanent(2)], bodyIds: ['b1:1', 'b1:2'] } } });
    const { totals, lines, scope } = await runExport(reader, parseArgs(['node', 's', '--battle', 'b1']));
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({ tickId: 'b1:1', body: { tickId: 'b1:1' } });
    expect(totals).toMatchObject({ minted: 3, captured: 2, attemptUnknown: 1, trailingGap: 1 });
    expect(scope).toBe('battle b1');
  });

  it('an EXPIRED body exports as `body: null` and is not read at all', async () => {
    const reader = makeReader({ battles: { b1: { minted: 2, ticks: [permanent(1), permanent(2)], bodyIds: ['b1:1'] } } });
    const { totals, lines } = await runExport(reader, parseArgs(['node', 's', '--battle', 'b1']));
    expect(JSON.parse(lines[1]).body).toBeNull();
    expect(reader.reads.filter((r) => r[0] === 'body').map((r) => r[2])).toEqual(['b1:1']);
    expect(totals.expiredBodies).toBe(1);
    expect(totals.attemptUnknown).toBe(0);      // expired is NEVER a gap
  });

  it('a DATE RANGE windows the OUTPUT but never the denominator', async () => {
    // Three captured ticks on three days; the window admits one. Coverage is
    // still measured against the battle's whole counter — a window cannot
    // contain its own denominator, so it is not allowed to become one.
    const reader = makeReader({ battles: { b1: { minted: 3, ticks: [permanent(1), permanent(2), permanent(3)], bodyIds: ['b1:1', 'b1:2', 'b1:3'] } } });
    const { totals, lines } = await runExport(reader, parseArgs(['node', 's', '--from', '2026-09-02', '--to', '2026-09-02']));
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).tickId).toBe('b1:2');
    expect(totals).toMatchObject({ minted: 3, captured: 3, coverage: 1 });
  });

  it('`--resolve-unknown` answers a timed-out write by presence', async () => {
    const reader = makeReader({ battles: { b1: { minted: 3, ticks: [permanent(1), permanent(3)], bodyIds: ['b1:1', 'b1:3'] } } });
    const { totals } = await runExport(reader, parseArgs(['node', 's', '--battle', 'b1', '--resolve-unknown', '2,3']));
    expect(totals.rows[0].resolvedUnknown).toEqual([
      { tickSeq: 2, resolution: 'missing' },
      { tickSeq: 3, resolution: 'landed' },
    ]);
  });

  it('many battles: the ids come from the range query, and each is read in full', async () => {
    const reader = makeReader({
      battles: {
        b1: { minted: 1, ticks: [permanent(1)], bodyIds: ['b1:1'] },
        b2: { minted: 2, ticks: [permanent(1)], bodyIds: [] },
      },
    });
    const { totals, battleIds } = await runExport(reader, parseArgs(['node', 's', '--from', '2026-09-01']));
    expect(battleIds).toEqual(['b1', 'b2']);
    expect(totals.battles).toBe(2);
    expect(totals.minted).toBe(3);
  });
});

describe('parseEnvFile', () => {
  it('returns {} for a path that does not exist rather than throwing', () => {
    expect(parseEnvFile(resolve(HERE, 'definitely-not-here.env'))).toEqual({});
  });
});
