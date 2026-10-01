// scripts/export-film-tape.test.js
//
// The founder read-out runner (BA-18), against the in-memory store. Importing
// the module runs nothing: main() is guarded behind the CLI entrypoint (the
// ws1-observe-walk.js precedent), so no admin SDK, no credentials and no
// network are touched — and that passing load is itself the BUILD_RULES §4
// dependency-surface guard for this script.
//
// The rows that matter: it writes NOTHING to Firestore (by source and by the
// store's write log), it reads only tape paths, it reads with the writer flag
// OFF (it is read-only, so the flag is irrelevant to it), `--battle --date`
// prints one day, `--recent` prints the most recent days first, and an absent
// day says so instead of printing nothing.

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));

import {
  argsProblem, makeFirestoreReader, MAX_RECENT, parseArgs, parseEnvFile, runExport, sortSeries, usage,
} from './export-film-tape.js';
import { formatTapeMarkdown } from '../api/_utils/filmTape/tapeExport.js';
import { writeTapeDay } from '../api/_utils/filmTape/writeTapeDay.js';
import { runCandlePass } from '../api/_utils/filmTape/candlePass.js';
import { makeTapeDb } from '../api/_utils/filmTape/__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay, multiDay } from '../api/_utils/filmTape/__fixtures__/tapeFixtures.js';
import { flatRows, fetcherOf } from '../api/_utils/filmTape/__fixtures__/tapeBars.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(HERE, 'export-film-tape.js'), 'utf8');
const FORMATTER = readFileSync(resolve(HERE, '../api/_utils/filmTape/tapeExport.js'), 'utf8');

const NIGHT = (d) => Date.parse(`${d}T23:59:00.000Z`) + 2 * 3600_000 + 16 * 60_000; // the close pass after d
const MORNING = Date.parse('2026-09-25T11:00:30.000Z');

let t; // the store: b-captured (one day, candles written) and b-multi (five days)
let multiDays;

beforeAll(async () => {
  flags.writer = true;
  const fx = await capturedDay();
  const m = await multiDay();
  multiDays = m.days;
  const initial = seedDay({}, fx);
  seedDay(initial, m);
  t = makeTapeDb(initial);
  await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: Date.parse('2026-09-25T02:15:30.000Z') });
  for (const d of m.days) await writeTapeDay(m.battleId, d, { db: t.db, now: NIGHT(d) });
  const bars = {};
  for (const s of ['AAPL', 'MSFT', 'NVDA', 'AMD', 'KO', 'PEP', 'TSLA', 'NFLX', 'XLK', 'XLP', 'XLC', 'XLY', 'SPY', 'RSP']) bars[s] = flatRows('2026-09-24', 100);
  await runCandlePass({ db: t.db, fetchCandles: fetcherOf(bars).fetchCandles, clock: () => MORNING, startMs: MORNING });
  flags.writer = false; // every read below runs with the writer flag OFF
});

describe('READ-ONLY by construction', () => {
  it('the source contains no Firestore write call, no flag import and no fetcher', () => {
    for (const forbidden of ['.set(', '.update(', '.create(', '.delete(', '.batch(', 'runTransaction', 'FieldValue', 'featureFlags', 'marketDataCache', 'fetch(']) {
      expect(SOURCE.includes(forbidden), `export script must not contain ${forbidden}`).toBe(false);
    }
    for (const forbidden of ['firebase', 'featureFlags', 'marketDataCache', 'fetch(']) {
      expect(FORMATTER.includes(forbidden), `the formatter must not contain ${forbidden}`).toBe(false);
    }
  });

  it('the reader exposes read methods only', () => {
    expect(Object.keys(makeFirestoreReader(t.db)).sort()).toEqual(['readRecentTapes', 'readSeries', 'readTape']);
  });

  it.each([
    ['--battle --date', { battle: 'b-captured', date: '2026-09-24', recent: null }],
    ['--battle --recent', { battle: 'b-multi', date: null, recent: '2' }],
    ['--recent (collection group)', { battle: null, date: null, recent: '3' }],
  ])('%s with the writer flag OFF writes nothing and reads only tape paths', async (_, flagsIn) => {
    const writes = t.writeLog.length;
    const reads = t.readLog.length;
    const out = await runExport(makeFirestoreReader(t.db), flagsIn);
    expect(out.days.length).toBeGreaterThan(0);
    expect(t.writeLog.length).toBe(writes);
    const touched = t.readLog.slice(reads).map((r) => (typeof r === 'string' ? r : JSON.stringify(r)));
    expect(touched.length).toBeGreaterThan(0);
    // the in-memory store labels a collection-group query `group:<name>` (review L4-F9)
    for (const r of touched) expect(r).toMatch(/^(agentBattles\/[^/]+\/tape(\/\d{4}-\d{2}-\d{2}(\/series)?)?|group:tape)$/);
  });

  it('main() is behind the CLI entrypoint — importing this module did nothing', () => {
    expect(SOURCE).toContain('if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename))');
  });
});

describe('--battle <id> --date <etDate>', () => {
  it('prints that day as the formatter prints it, with its series summarised in reading order', async () => {
    const reader = makeFirestoreReader(t.db);
    const out = await runExport(reader, { battle: 'b-captured', date: '2026-09-24', recent: null });
    const doc = await reader.readTape('b-captured', '2026-09-24');
    const series = await reader.readSeries('b-captured', '2026-09-24');
    expect(series.length).toBe(doc.passes.candles.symbolsRequested.length);
    expect(out.markdown).toBe(formatTapeMarkdown(doc, sortSeries(series)));
    expect(out.markdown).toContain('> coverage: **');
    expect(out.markdown).not.toContain('UNCLASSIFIED');
    const roles = sortSeries(series).map((s) => s.role);
    expect(roles).toEqual([...roles].sort((a, b) => ['held', 'sold', 'plan', 'market', 'sector'].indexOf(a) - ['held', 'sold', 'plan', 'market', 'sector'].indexOf(b)));
  });

  it('an absent day says so — never an empty read-out', async () => {
    const out = await runExport(makeFirestoreReader(t.db), { battle: 'b-captured', date: '2026-09-23', recent: null });
    expect(out.days).toEqual([]);
    expect(out.markdown).toBe('# Film tape — no document at `agentBattles/b-captured/tape/2026-09-23`\n\nNo tape for this day.\n');
  });
});

describe('--recent <n>', () => {
  it('with --battle: that battle\'s most recent days, newest first, separated', async () => {
    const out = await runExport(makeFirestoreReader(t.db), { battle: 'b-multi', date: null, recent: '3' });
    expect(out.days).toEqual([...multiDays].reverse().slice(0, 3).map((etDate) => ({ battleId: 'b-multi', etDate })));
    expect(out.markdown.split('\n---\n\n')).toHaveLength(3);
    expect(out.markdown.indexOf('`2026-09-25`')).toBeLessThan(out.markdown.indexOf('`2026-09-24`'));
  });

  it('without --battle: the most recent tape days of any battle (collection group), newest first', async () => {
    const out = await runExport(makeFirestoreReader(t.db), { battle: null, date: null, recent: '3' });
    expect(out.days.map((d) => d.etDate)).toEqual(['2026-09-25', '2026-09-24', '2026-09-24']);
    expect(new Set(out.days.map((d) => d.battleId))).toEqual(new Set(['b-multi', 'b-captured']));
  });

  it('nothing found says so', async () => {
    const out = await runExport(makeFirestoreReader(t.db), { battle: 'b-none', date: null, recent: '2' });
    expect(out.markdown).toBe('# Film tape — no tape documents for `b-none`\n\nNo tape days found.\n');
  });
});

describe('arguments', () => {
  it('parses every flag', () => {
    expect(parseArgs(['node', 's', '--battle', 'b1', '--date', '2026-09-24', '--out', 'x.md'])).toEqual({ battle: 'b1', date: '2026-09-24', recent: null, out: 'x.md', help: false });
    expect(parseArgs(['node', 's', '--recent', '5']).recent).toBe('5');
    expect(parseArgs(['node', 's', '-h']).help).toBe(true);
  });

  it('names what is wrong, in one line', () => {
    const p = (argv) => argsProblem(parseArgs(['node', 's', ...argv]));
    expect(p(['--battle', 'b1', '--date', '2026-09-24'])).toBeNull();
    expect(p(['--recent', '5'])).toBeNull();
    expect(p(['--battle', 'b1', '--recent', String(MAX_RECENT)])).toBeNull();
    expect(p(['--help'])).toBeNull();
    expect(p([])).toMatch(/^nothing to read/);
    expect(p(['--battle', 'b1'])).toMatch(/^nothing to read/);
    expect(p(['--date', '2026-09-24'])).toBe('--date needs --battle <id>');
    expect(p(['--battle', 'b1', '--date', '09/24/2026'])).toBe('--date must be an ET trading date, YYYY-MM-DD');
    expect(p(['--recent', '0'])).toMatch(/^--recent must be a whole number/);
    expect(p(['--recent', String(MAX_RECENT + 1)])).toMatch(/^--recent must be a whole number/);
    expect(p(['--recent', '2.5'])).toMatch(/^--recent must be a whole number/);
    expect(p(['--battle', 'b1', '--date', '2026-09-24', '--recent', '2'])).toBe('use --date or --recent, not both');
  });

  it('the usage says it writes nothing and reads regardless of the flag', () => {
    expect(usage()).toContain('Writes NOTHING to Firestore. Reads regardless of FILM_TAPE_WRITE_ENABLED.');
  });

  it('parseEnvFile reads KEY=VALUE lines and a missing file is empty', () => {
    expect(parseEnvFile(resolve(HERE, 'does-not-exist.env'))).toEqual({});
  });
});
