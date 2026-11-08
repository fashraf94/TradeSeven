// scripts/per-game-loadout-preflip-census.test.js
//
// The armory flip (founder ruling FL6) — the pre-flip census of the League locks: its answer on a fixture of every
// kind of group (each stale reason, a training pod, a CPU seat, a player in two groups, each field the week can come
// from), and that it is read-only by construction (the census-activation-evidence.test.js precedent): pinned imports,
// credentials only inside main(), every member call on a reviewed read list, the reader a double records.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  CENSUS_LIMIT, DEFAULT_JSON_NAME, GROUP_FIELDS, censusMain, parseArgs, renderCounts, restrictedReader, runCensus, weekFieldOf,
} from './per-game-loadout-preflip-census.mjs';
import { battleAnchorEtDateFromInstant, battleAnchorEtDateOf, LEAGUE_LOCK_STATUSES } from '../src/constants/perGameLoadout.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(HERE, 'per-game-loadout-preflip-census.mjs'), 'utf8').replace(/\r\n/g, '\n');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// Sunday Nov 8, 2026, noon ET: the weekend before the week of Nov 9–13.
const NOW = Date.parse('2026-11-08T17:00:00.000Z');

// Sentinel ids: none may reach stdout; no player id may reach the JSON.
const GROUPS = [
  // this week's battle, stamped: locks until Fri Nov 13's close. Two players and a CPU seat.
  { id: 'GRP-SENTINEL-A', status: 'battle', updatedAt: '2026-11-06T10:00:00.000Z', startAnchor: { anchorEtDate: '2026-11-09' }, groupMembers: ['UID-SENTINEL-1', 'UID-SENTINEL-2', 'cpu-3'] },
  // stuck in forming since October, no stamp: the week derived from createdAt has long ended — STALE.
  { id: 'GRP-SENTINEL-B', status: 'forming', updatedAt: '2026-10-12T15:00:00.000Z', createdAt: '2026-10-12T15:00:00.000Z', groupMembers: ['UID-SENTINEL-3'] },
  // a training pod: never locks, never counted.
  { id: 'GRP-SENTINEL-C', status: 'forming', isTraining: true, updatedAt: '2026-11-07T10:00:00.000Z', createdAt: '2026-11-07T10:00:00.000Z', groupMembers: ['UID-SENTINEL-4'] },
  // a live draft scheduled for tonight: the week of Nov 9. Player 1 again, and newer, so it is player 1's lock.
  { id: 'GRP-SENTINEL-D', status: 'drafting', isLiveDraft: true, updatedAt: '2026-11-08T12:00:00.000Z', scheduledDraftAt: '2026-11-08T23:00:00.000Z', createdAt: '2026-11-01T12:00:00.000Z', groupMembers: ['UID-SENTINEL-1'] },
  // nothing readable: the lock holds with no end — STALE (no lock end).
  { id: 'GRP-SENTINEL-E', status: 'awaiting_open', updatedAt: '2026-11-07T09:00:00.000Z', groupMembers: ['UID-SENTINEL-5'] },
  // last week's battle, banked from day 1 (Nov 2): it ended Fri Nov 6 and never completed — STALE.
  { id: 'GRP-SENTINEL-F', status: 'battle', updatedAt: '2026-11-06T22:00:00.000Z', dailyScores: { day1: { recordedDate: '2026-11-02' } }, groupMembers: ['UID-SENTINEL-6'] },
  // a slot claim for the week after next, no members yet.
  { id: 'GRP-SENTINEL-G', status: 'forming', updatedAt: '2026-11-07T08:00:00.000Z', battleStartWeek: { anchorEtDate: '2026-11-16' }, groupMembers: [] },
];
// The armory flip review, AF-2: the double answers as Firestore's select() does, so a field the census's mask leaves out
// reads as absent here too. Each document keeps its id and only the masked paths it has, nested as Firestore nests them
// ('startAnchor.anchorEtDate' → { startAnchor: { anchorEtDate } }); a path the document lacks stays absent.
const pick = (doc, fields) => {
  const out = { id: doc.id };
  for (const field of fields) {
    const keys = field.split('.');
    const value = keys.reduce((o, k) => (o != null && typeof o === 'object' ? o[k] : undefined), doc);
    if (value === undefined) continue;
    let at = out;
    for (const k of keys.slice(0, -1)) at = (at[k] ??= {});
    at[keys.at(-1)] = structuredClone(value);
  }
  return out;
};
const readerOf = (docs) => {
  const calls = [];
  return { calls, query: async (q) => { calls.push(q); return docs.map((d) => pick(d, q.fields)); } };
};

describe('the answer', () => {
  it('counts the ranked groups that lock, their players once each, and which are stale', async () => {
    const R = await runCensus(readerOf(GROUPS), { nowMs: NOW });
    expect(R.totals).toEqual({
      groupsRead: 7,
      trainingExcluded: 1,
      groupsLocking: 6,
      playersLocked: 5,            // UID 1, 2, 3, 5, 6: not the training pod's, not the CPU seat
      playersInTwoOrMoreGroups: 1, // UID 1
      staleGroups: 3,              // B, E, F
      staleGroupsNoLockEnd: 1,     // E
      stalePlayers: 3,             // UID 3, 5, 6 (UID 1's lock is D's, which ends Fri Nov 13)
    });
    expect(R.byStatus).toEqual({ forming: 2, drafting: 1, awaiting_open: 1, battle: 2 });
    expect(R.staleByStatus).toEqual({ forming: 1, drafting: 0, awaiting_open: 1, battle: 1 });
    expect(R.truncated).toBe(false);
  });

  it('each group: its status, its week and the field it came from, its players, the lock end leagueLockOf gives', async () => {
    const R = await runCensus(readerOf(GROUPS), { nowMs: NOW });
    const by = Object.fromEntries(R.groups.map((g) => [g.groupId, g]));
    expect(by['GRP-SENTINEL-A']).toEqual({ groupId: 'GRP-SENTINEL-A', status: 'battle', weekOf: '2026-11-09', weekField: 'startAnchor.anchorEtDate', players: 2, cpuSeats: 1, lockEndsAt: '2026-11-13T21:00:00.000Z', stale: false, staleReason: null });
    expect(by['GRP-SENTINEL-B']).toMatchObject({ weekField: 'createdAt', weekOf: '2026-10-19', lockEndsAt: '2026-10-23T20:00:00.000Z', stale: true, staleReason: 'lock_end_passed' });
    expect(by['GRP-SENTINEL-C']).toBeUndefined();
    expect(by['GRP-SENTINEL-D']).toMatchObject({ weekField: 'scheduledDraftAt', weekOf: '2026-11-09', lockEndsAt: '2026-11-13T21:00:00.000Z', stale: false });
    expect(by['GRP-SENTINEL-E']).toMatchObject({ weekField: null, weekOf: null, lockEndsAt: null, stale: true, staleReason: 'no_lock_end' });
    expect(by['GRP-SENTINEL-F']).toMatchObject({ weekField: 'dailyScores.day1.recordedDate', weekOf: '2026-11-02', lockEndsAt: '2026-11-06T21:00:00.000Z', stale: true });
    expect(by['GRP-SENTINEL-G']).toMatchObject({ weekField: 'battleStartWeek.anchorEtDate', weekOf: '2026-11-16', players: 0, stale: false });
  });

  it('a lock end exactly now has passed; a minute later than now has not', async () => {
    const end = Date.parse('2026-11-13T21:00:00.000Z');
    const one = [GROUPS[0]];
    expect((await runCensus(readerOf(one), { nowMs: end })).totals.staleGroups).toBe(1);
    expect((await runCensus(readerOf(one), { nowMs: end - 60_000 })).totals.staleGroups).toBe(0);
  });

  it('the cited field is the one battleAnchorEtDateOf took the week from, on every fixture', () => {
    for (const g of GROUPS) {
      const field = weekFieldOf(g);
      const week = battleAnchorEtDateOf(g);
      if (field === null) { expect(week, g.id).toBeNull(); continue; }
      const value = field.split('.').reduce((o, k) => o?.[k], g);
      expect(week, g.id).toBe(/At$/.test(field) ? battleAnchorEtDateFromInstant(Date.parse(value)) : value);
    }
  });

  it('a read that fills the limit says it is truncated', async () => {
    const many = Array.from({ length: CENSUS_LIMIT }, (_, i) => ({ id: `t${i}`, status: 'forming', isTraining: true }));
    expect((await runCensus(readerOf(many), { nowMs: NOW })).truncated).toBe(true);
  });
});

describe('what reaches each channel', () => {
  it('stdout carries counts only: no group id, no player id', async () => {
    const lines = [];
    const files = {};
    await censusMain({ argv: ['--json', 'out.json'], reader: readerOf(GROUPS), writeFile: (p, s) => { files[p] = s; }, log: (s) => lines.push(s), nowMs: NOW });
    const out = lines.join('\n');
    expect(out).not.toMatch(/SENTINEL|cpu-3/);
    expect(out).toContain('ranked groups locking: 6');
    expect(out).toContain('players locked: 5');
    expect(out).toContain('stale groups: 3');
    expect(out).toContain('stale players: 3');
    // the JSON names groups (it stays outside version control) and never a player
    expect(Object.keys(files)).toEqual(['out.json']);
    expect(files['out.json']).toContain('GRP-SENTINEL-B');
    expect(files['out.json']).not.toMatch(/UID-SENTINEL|cpu-3/);
  });

  it('the default report lands at the repo root under a name .gitignore keeps out of version control', () => {
    expect(parseArgs([]).jsonPath.replace(/\\/g, '/')).toMatch(new RegExp(`/${DEFAULT_JSON_NAME.replace(/\./g, '\\.')}$`));
    const ignore = readFileSync(resolve(HERE, '..', '.gitignore'), 'utf8').replace(/\r\n/g, '\n').split('\n');
    expect(ignore).toContain(DEFAULT_JSON_NAME);
    expect(() => parseArgs(['--write'])).toThrow(/unknown argument/);
  });

  it('renderCounts names no id even when every group is stale', async () => {
    const R = await runCensus(readerOf(GROUPS), { nowMs: Date.parse('2027-01-01T00:00:00Z') });
    expect(renderCounts(R)).not.toMatch(/SENTINEL/);
    expect(R.totals.staleGroups).toBe(6);
  });
});

describe('read-only by construction', () => {
  it('the static imports are the lock\'s pure model and a constants module, nothing else', () => {
    const imports = [...CODE.matchAll(/^import [\s\S]*? from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports).toEqual(['node:fs', 'node:path', 'node:url', '../src/constants/perGameLoadout.js', '../src/constants/leagueTournament.js']);
  });

  it('the credentials load only inside main(), lazily', () => {
    const dynamic = [...CODE.matchAll(/await import\('([^']+)'\)/g)];
    expect(dynamic.map((m) => m[1])).toEqual(['./loadLocalEnv.js', '../api/_utils/firebaseAdmin.js']);
    const mainAt = CODE.indexOf('export async function main(');
    expect(mainAt).toBeGreaterThan(0);
    expect(dynamic.every((m) => m.index > mainAt)).toBe(true);
    expect(CODE).toMatch(/if \(invokedDirectly\) main\(\)/);
  });

  it('every member call is on a reviewed read-only list: a write, a batch or a transaction fails here', () => {
    const calls = [...new Set([...CODE.replace(/'[^'\n]*'|`[^`]*`/g, '""').matchAll(/\.([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1]))].sort();
    const ALLOWED = [
      // Firestore, inside restrictedReader only — reads
      'collection', 'where', 'limit', 'select', 'get', 'data',
      // the restricted reader's own surface
      'query',
      // language
      'basename', 'catch', 'dirname', 'entries', 'error', 'exit', 'filter', 'freeze', 'fromEntries', 'has', 'isArray', 'join', 'localeCompare',
      'log', 'map', 'now', 'push', 'resolve', 'slice', 'sort', 'startsWith', 'stringify', 'test', 'toISOString', 'values',
      // a Map, the players' own groups (never Firestore)
      'set',
    ];
    expect(calls.filter((c) => !ALLOWED.includes(c))).toEqual([]);
    expect(CODE).not.toMatch(/runTransaction|bulkWriter|recursiveDelete|writeBatch|FieldValue|\.batch\(|\.update\(|\.create\(|\.delete\(|\.add\(/);
    expect([...CODE.matchAll(/\.set\(/g)].length).toBe(1);
    expect(CODE).toMatch(/byPlayer\.set\(uid, \[\]\)/);
  });

  it('the reader makes one field-masked query and nothing else, and hands out no handle', async () => {
    const log = [];
    const chain = {
      where: (...a) => { log.push(['where', ...a]); return chain; },
      limit: (n) => { log.push(['limit', n]); return chain; },
      select: (...f) => { log.push(['select', ...f]); return chain; },
      get: async () => { log.push(['get']); return { docs: [{ id: 'g1', data: () => ({ status: 'forming' }) }] }; },
    };
    const db = new Proxy({ collection: (name) => { log.push(['collection', name]); return chain; } }, {
      get: (t, k) => { if (k !== 'collection') throw new Error(`the reader touched db.${String(k)}`); return t[k]; },
    });
    const reader = restrictedReader(db);
    expect(Object.keys(reader)).toEqual(['query']);
    expect(Object.isFrozen(reader)).toBe(true);
    const R = await runCensus(reader, { nowMs: NOW });
    expect(log).toEqual([
      ['collection', 'tournamentGroups'],
      ['where', 'status', 'in', [...LEAGUE_LOCK_STATUSES]],
      ['limit', CENSUS_LIMIT],
      ['select', ...GROUP_FIELDS],
      ['get'],
    ]);
    expect(R.totals.groupsRead).toBe(1);
  });
});
