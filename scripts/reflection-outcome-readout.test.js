// scripts/reflection-outcome-readout.test.js
//
// Reflection outage fix (P-OUT-1, founder ruling O4) — the read-only outcome
// readout. Importing the module runs nothing (main() is guarded behind the CLI
// entrypoint and loads its credentials lazily); that passing load is the
// BUILD_RULES §4 dependency-surface guard for this script. The read-only proof
// follows the growth replay's §7 discipline: the write-call grep over the
// source, and every member call pinned to a reviewed read-only allowlist.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'acorn';
import {
  computeReflectionOutcomeReadout, renderReflectionOutcomeReadout, parseArgs,
  firestoreReader, runReflectionOutcomeReadout,
} from './reflection-outcome-readout.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(HERE, 'reflection-outcome-readout.mjs'), 'utf8');

const rec = (over) => ({
  outcome: 'failed', failureClass: 'timeout', errorName: 'ReflectionDeadlineError', elapsedMs: 35_000,
  stopReason: null, usage: null, model: 'claude-sonnet-4-6', attempt: 1, at: '2026-10-12T21:00:00.000Z', ...over,
});
// Rows as Firestore returns them through the reader — ids planted to prove they never print.
const ROWS = [
  { id: 'battle-SECRET-1', ownerId: 'owner-SECRET', reflectionOutcome: rec({ outcome: 'ok', failureClass: null, errorName: null, elapsedMs: 18_000, stopReason: 'tool_use', usage: { input_tokens: 3800, output_tokens: 950 }, at: '2026-10-12T21:00:00.000Z' }), pendingReflection: false },
  { id: 'battle-SECRET-2', reflectionOutcome: rec({ outcome: 'ok', failureClass: null, errorName: null, elapsedMs: 21_000, usage: { input_tokens: 3900, output_tokens: 1030 }, attempt: 2, at: '2026-10-13T21:15:00.000Z' }), pendingReflection: false },
  { id: 'battle-SECRET-3', reflectionOutcome: rec({ attempt: 1, at: '2026-10-13T21:00:00.000Z' }), pendingReflection: true },
  { id: 'battle-SECRET-4', reflectionOutcome: rec({ failureClass: 'http_529', errorName: 'InternalServerError', attempt: 3, at: '2026-10-13T21:45:00.000Z' }), pendingReflection: false, reflectionNoLesson: true },
  { id: 'battle-SECRET-5', reflectionOutcome: rec({ at: '2026-10-20T00:00:00.000Z' }), pendingReflection: true }, // outside the range
  { id: 'battle-SECRET-6', pendingReflection: false },                                                            // reflected before the fix
];

describe('computeReflectionOutcomeReadout', () => {
  const r = computeReflectionOutcomeReadout(ROWS, { fromDay: '2026-10-12', toDay: '2026-10-13' });

  it('counts the latest attempt per battle in range: ok / failed, failed by class, the end states', () => {
    expect(r).toMatchObject({ battles: 4, ok: 2, failed: 2, noLesson: 1, retrying: 1, endedOtherwise: 0 });
    expect(r.failedByClass).toEqual({ timeout: 1, http_529: 1 });
    expect(r.latestAttempt).toEqual({ 1: 2, 2: 1, 3: 1 });
    expect(r.okElapsedMs).toEqual({ max: 21_000, total: 39_000, n: 2 });
    expect(r.maxOutputTokens).toBe(1030);
  });

  it('buckets by the UTC day of the latest attempt', () => {
    expect(r.byDay).toEqual({
      '2026-10-12': { ok: 1, failed: 0, classes: {} },
      '2026-10-13': { ok: 1, failed: 2, classes: { timeout: 1, http_529: 1 } },
    });
  });

  it('a failed latest attempt that is neither retrying nor finished without a lesson is counted, so the failed total reconciles (review RV-6)', () => {
    const rows = [{ reflectionOutcome: rec({ at: '2026-10-12T21:00:00.000Z' }), pendingReflection: false }];
    const r2 = computeReflectionOutcomeReadout(rows, { fromDay: '2026-10-12', toDay: '2026-10-12' });
    expect(r2).toMatchObject({ failed: 1, noLesson: 0, retrying: 0, endedOtherwise: 1 });
    expect(r2.noLesson + r2.retrying + r2.endedOtherwise).toBe(r2.failed);
  });

  it('the range is inclusive at both ends and ignores rows with no record', () => {
    expect(computeReflectionOutcomeReadout(ROWS, { fromDay: '2026-10-13', toDay: '2026-10-13' }).battles).toBe(3);
    expect(computeReflectionOutcomeReadout(ROWS, { fromDay: '2026-10-20', toDay: '2026-10-20' }).battles).toBe(1);
    expect(computeReflectionOutcomeReadout(ROWS, { fromDay: '2026-10-01', toDay: '2026-10-11' }).battles).toBe(0);
  });
});

describe('the rendered readout', () => {
  const r = computeReflectionOutcomeReadout(ROWS, { fromDay: '2026-10-12', toDay: '2026-10-13' });
  const text = renderReflectionOutcomeReadout(r, { readAt: '2026-10-14T00:00:00.000Z' });

  it('prints the counts by class and by day', () => {
    expect(text).toContain('Battles: 4   ok: 2   failed: 2   (of the failed: finished without a lesson 1, still retrying 1, ended otherwise 0)');
    expect(text).toMatch(/timeout\s+1/);
    expect(text).toMatch(/http_529\s+1/);
    expect(text).toContain('2026-10-13  ok 1  failed 2  (http_529 1, timeout 1)');
    expect(text).toContain('Successful calls: slowest 21.0 s, average 19.5 s');
  });

  it('prints NO id of any kind', () => {
    expect(text).not.toMatch(/SECRET/);
    expect(JSON.stringify(r)).not.toMatch(/SECRET/);
  });
});

describe('parseArgs', () => {
  it('defaults to the seven days before today; both bounds parse; bad input throws', () => {
    expect(parseArgs([], { today: '2026-10-14' })).toEqual({ fromDay: '2026-10-07', toDay: '2026-10-14', jsonPath: null });
    expect(parseArgs(['--from', '2026-10-11', '--to', '2026-10-12', '--json', 'o.json'])).toEqual({ fromDay: '2026-10-11', toDay: '2026-10-12', jsonPath: 'o.json' });
    expect(() => parseArgs(['--to', 'yesterday'])).toThrow(/YYYY-MM-DD/);
    expect(() => parseArgs(['--from', '2026-10-13', '--to', '2026-10-12'])).toThrow(/after/);
  });
});

describe('read-only by construction (the growth replay §7 discipline)', () => {
  it('the §7 write-call grep finds nothing in the source', () => {
    expect(SOURCE).not.toMatch(/\.(set|update|delete|add|create)\s*\(|runTransaction|\.batch\(|bulkWriter|writeBatch|FieldValue|recursiveDelete/);
  });

  it('every member call — walked on the syntax tree, computed members included — is on a reviewed read-only allowlist', () => {
    const ast = parse(SOURCE, { ecmaVersion: 'latest', sourceType: 'module' });
    const calls = new Set();
    const computed = [];
    const walk = (n) => {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression') {
        if (!n.callee.computed) calls.add(n.callee.property.name);
        else if (n.callee.property.type === 'Literal') calls.add(String(n.callee.property.value));
        else computed.push(SOURCE.slice(n.start, n.end));
      }
      for (const k of Object.keys(n)) {
        const v = n[k];
        if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v);
      }
    };
    walk(ast);
    const ALLOWED = [
      // Firestore — reads only
      'collection', 'where', 'select', 'get', 'data',
      // the read-only reader's own method
      'readOutcomeRows',
      // language
      'catch', 'endsWith', 'error', 'exit', 'includes', 'indexOf', 'isFinite', 'isInteger', 'join', 'keys', 'log', 'map', 'max',
      'padEnd', 'parse', 'pop', 'push', 'replace', 'slice', 'sort', 'split', 'stringify', 'test', 'toFixed', 'toISOString',
    ];
    expect([...calls].filter((c) => !ALLOWED.includes(c)).sort()).toEqual([]);
    expect(computed).toEqual([]);
    expect(calls.size).toBeGreaterThan(15);
  });

  it('the reader asks Firestore for the three outcome fields of completed battles and returns no id', async () => {
    const seen = [];
    const db = {
      collection: (name) => { seen.push(['collection', name]); return {
        where: (...w) => { seen.push(['where', ...w]); return {
          select: (...f) => { seen.push(['select', ...f]); return {
            get: async () => ({ docs: [{ id: 'battle-SECRET', data: () => ({ reflectionOutcome: rec({}), pendingReflection: true }) }] }),
          }; },
        }; },
      }; },
    };
    const rows = await firestoreReader(db).readOutcomeRows();
    expect(seen).toEqual([
      ['collection', 'agentBattles'],
      ['where', 'status', '==', 'completed'],
      ['select', 'reflectionOutcome', 'reflectionNoLesson', 'pendingReflection'],
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/SECRET/);
    const r = await runReflectionOutcomeReadout(firestoreReader(db), { fromDay: '2026-10-12', toDay: '2026-10-12' });
    expect(r).toMatchObject({ battles: 1, failed: 1, retrying: 1 });
  });

  it('loads its credentials only inside main(), and importing it runs no env loader', async () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    expect(code).not.toMatch(/^import ['"]\.\/loadLocalEnv\.js['"]/m);
    expect(code).not.toMatch(/^import .*firebaseAdmin/m);
    expect(code).toMatch(/await import\('\.\/loadLocalEnv\.js'\)/);
    expect(code).toMatch(/if \(invokedDirectly\) main\(\)/);
    vi.resetModules();
    const loaded = vi.fn();
    vi.doMock('./loadLocalEnv.js', () => { loaded(); return {}; });
    try {
      await import('./reflection-outcome-readout.mjs');
      expect(loaded).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('./loadLocalEnv.js');
      vi.resetModules();
    }
  });
});
