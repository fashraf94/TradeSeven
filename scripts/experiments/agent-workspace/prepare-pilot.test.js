import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
// Real imports guard the offline Node dependency surface. No adapters are mocked.
import { casesFromSlice, preparePilot, SYMBOLS, DATES } from './prepare-pilot.mjs';
import { createExperiment, digest, validateInput } from './experiment.mjs';
import { getPreviousSessionDate } from '../../../src/utils/marketCalendar.js';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function slice(symbol = 'AAPL.US') {
  const rows = [];
  let date = '2026-10-30';
  for (let i = 0; i < 60; i++) {
    rows.push({ date, open: 100, high: 105, low: 95, close: 101, adjusted_close: 99, volume: 1000 });
    date = getPreviousSessionDate(date);
  }
  return { symbol, sources: { eod: { entry: { symbol, kind: 'eod' }, source: `https://eodhd.com/api/eod/${symbol}`, sha256: 'a'.repeat(64), retrieved_at_utc: '2026-11-03T06:05:43.751324+00:00' } }, datasets: { eod: rows.reverse() } };
}
async function packageFixture(root) {
  await mkdir(path.join(root, 'inputs/slices'), { recursive: true });
  const files = {};
  const slices = [];
  const put = async (name, value) => {
    const bytes = JSON.stringify(value);
    await writeFile(path.join(root, name), bytes);
    files[name] = { sha256: hash(bytes), bytes: Buffer.byteLength(bytes) };
  };
  for (const symbol of SYMBOLS) {
    const name = `inputs/slices/${symbol}.json`;
    const value = slice(symbol);
    await put(name, value);
    slices.push({ symbol, path: name, sha256: files[name].sha256, row_counts: { eod: value.datasets.eod.length } });
  }
  await put('inputs/slice-manifest.json', { slices });
  await put('PACKAGE-MANIFEST.json', { files });
}

describe('saved pilot preparation', () => {
  it('selects fixed pre-close dates, excludes future bars, preserves raw fields and original input', () => {
    const source = slice();
    const before = JSON.stringify(source);
    const cases = casesFromSlice(source, 'AAPL.US');
    expect(cases.map(c => c.asOf)).toEqual(DATES);
    expect(cases.map(c => c.rows[0].date)).toEqual(['2026-10-27', '2026-10-28', '2026-10-29']);
    for (const c of cases) {
      expect(c.rows).toHaveLength(55);
      expect(c.rows[0]).toMatchObject({ rawClose: 101, adjustedClose: 99, volume: 1000 });
      expect(c.recordedAt).toBe('2026-11-03T06:05:43.751Z');
      expect(c.evidenceKind).toBe('later_reconstruction');
      expect(c.rows.every(r => r.date < c.asOf)).toBe(true);
    }
    expect(JSON.stringify(source)).toBe(before);
  });

  it('leaves missing prices and volume absent instead of substituting adjusted prices or zero', () => {
    const source = slice();
    const row = source.datasets.eod.find(r => r.date === '2026-10-27');
    delete row.close;
    delete row.volume;
    const input = validateInput({ schemaVersion: 'ft.agent-workspace-input.v1', title: 'Missing saved fields', cases: casesFromSlice(source, 'AAPL.US') });
    expect(input.cases[0].rows[0]).toMatchObject({ rawClose: null, volume: null, adjustedClose: 99 });
    const files = [{ path: 'test.js', sha256: 'b'.repeat(64) }];
    const run = createExperiment({ input, provenance: { gitCommit: 'c'.repeat(40), dirty: false, nodeVersion: process.version, files, sourceDigest: digest(files) }, createdAt: '2026-11-09T00:00:00.000Z' });
    expect(run.cases[0].baseline.decision).toBe('unknown');
    expect(run.cases[0].entry.refusal.reason).toBe('missing_fact');
  });

  it('refuses duplicate dates and source substitution before preparing a packet', () => {
    const source = slice();
    source.datasets.eod.push(source.datasets.eod[0]);
    expect(() => casesFromSlice(source, 'AAPL.US')).toThrow(/duplicate/);
    expect(() => casesFromSlice(slice(), 'NVDA.US')).toThrow(/source/);
    const malformed = slice();
    malformed.sources.eod.retrieved_at_utc = '2027-02-30T06:05:43Z';
    expect(() => casesFromSlice(malformed, 'AAPL.US')).toThrow(/retrieval clock/);
  });

  it('checks both manifests, records input hashes, and runs without fetch', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'saved-pilot-test-'));
    const network = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('network forbidden'); });
    try {
      await packageFixture(root);
      const result = await preparePilot(root, path.join(root, 'out'));
      expect(result.input.cases).toHaveLength(9);
      expect(result.manifest.sources.map(s => s.symbol)).toEqual(SYMBOLS);
      expect(result.manifest.sources[0].retrievedAtOriginal).toBe('2026-11-03T06:05:43.751324+00:00');
      expect(hash(await readFile(path.join(result.folder, 'input.json')))).toBe(result.manifest.inputSha256);
      const name = path.join(root, 'inputs/slices/AAPL.US.json');
      await writeFile(name, (await readFile(name, 'utf8')) + ' ');
      await expect(preparePilot(root, path.join(root, 'out'))).rejects.toThrow(/integrity mismatch/);
      await packageFixture(root);
      const slicePath = path.join(root, 'inputs/slice-manifest.json');
      const slices = JSON.parse(await readFile(slicePath, 'utf8'));
      slices.slices[0].sha256 = '0'.repeat(64);
      const bytes = JSON.stringify(slices);
      await writeFile(slicePath, bytes);
      const packagePath = path.join(root, 'PACKAGE-MANIFEST.json');
      const changed = JSON.parse(await readFile(packagePath, 'utf8'));
      changed.files['inputs/slice-manifest.json'] = { sha256: hash(bytes), bytes: Buffer.byteLength(bytes) };
      await writeFile(packagePath, JSON.stringify(changed));
      await expect(preparePilot(root, path.join(root, 'out'))).rejects.toThrow(/Slice integrity mismatch/);
      await packageFixture(root);
      const manifest = JSON.parse(await readFile(path.join(root, 'PACKAGE-MANIFEST.json'), 'utf8'));
      delete manifest.files['inputs/slices/MSFT.US.json'];
      await writeFile(path.join(root, 'PACKAGE-MANIFEST.json'), JSON.stringify(manifest));
      await expect(preparePilot(root, path.join(root, 'out'))).rejects.toThrow(/Missing package hash/);
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); await rm(root, { recursive: true, force: true }); }
  });
});
