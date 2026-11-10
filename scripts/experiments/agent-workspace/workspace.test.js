import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
// Dependency-surface guard: real unmocked imports exercise the production evaluator,
// adapter, and Node-clean src helpers. No Firebase client or production handler is called.
import { createExperiment, verifyExperiment, digest } from './experiment.mjs';
import { demoInput } from './demo.mjs';
import { renderReport } from './report.mjs';
import { main, parseArgs, readJson } from './run.mjs';

const files = [{ path: 'test-source.js', sha256: 'a'.repeat(64) }];
const provenance = { gitCommit: 'b'.repeat(40), dirty: false, nodeVersion: process.version, files, sourceDigest: digest(files) };
const createdAt = '2026-11-09T12:00:00.000Z';
const make = (options = {}) => createExperiment({ input: demoInput(), provenance, createdAt, ...options });
const clone = value => JSON.parse(JSON.stringify(value));
afterEach(() => vi.restoreAllMocks());

describe('offline experiment decisions and evidence', () => {
  it('changes pullback-only admission without changing the shared evaluator verdict', () => {
    const run = make();
    const pullback = run.cases.find(c => c.id === 'pullback_touch_bar2_exact');
    expect(pullback.entry.verdict).toBe('valid');
    expect(pullback.entry.pattern).toBe('pullback_resume');
    expect(pullback.baseline.decision).toBe('admitted');
    expect(pullback.candidate).toEqual({ decision: 'refused', reason: 'breakout_required' });
    expect(pullback.changed).toBe(true);
    const breakout = run.cases.find(c => c.id === 'breakout_at_swing_high');
    expect(breakout.baseline.decision).toBe('admitted');
    expect(breakout.candidate.decision).toBe('admitted');
    expect(breakout.changed).toBe(false);
    const both = run.cases.find(c => c.id === 'both_patterns');
    expect(both.candidate.decision).toBe('admitted');
    expect(run.summary).toEqual({ total: 6, changed: 2, baseline: { admitted: 4, refused: 1, unknown: 1 }, candidate: { admitted: 2, refused: 2, unknown: 2 } });
  });

  it('preserves unknown on missing history and untestable breakout evidence', () => {
    const run = make();
    const short = run.cases.find(c => c.id === 'bars_54');
    expect(short.entry.refusal.reason).toBe('insufficient_history');
    expect(short.baseline.decision).toBe('unknown');
    expect(short.candidate.decision).toBe('unknown');
    const volume = run.cases.find(c => c.id === 'c1_pullback_null_bar0_volume');
    expect(volume.baseline.decision).toBe('admitted');
    expect(volume.candidate).toEqual({ decision: 'unknown', reason: 'breakout_evidence_unavailable' });
  });

  it('the unchanged control gives zero differences and preserves all outputs', () => {
    const run = make({ candidate: 'baseline-control-v1' });
    expect(run.summary.changed).toBe(0);
    for (const c of run.cases) expect(c.candidate).toEqual(c.baseline);
  });

  it('uses the recorded clock and refuses a missing completed session', () => {
    const input = demoInput();
    input.cases[0].observedAt = '2026-10-09T15:00:00.000Z';
    const run = make({ input });
    expect(run.cases[0].entry.asOf).toBe('2026-10-08');
    expect(run.cases[0].entry.factsUsed.C.value).toBe(99.75);
    input.cases[0].rows.splice(1, 1);
    const missing = make({ input });
    expect(missing.cases[0].entry.refusal.reason).toBe('missing_bar');
    expect(missing.cases[0].candidate.decision).toBe('unknown');
  });

  it('retains reconstructed provenance and never manufactures a market outcome', () => {
    const input = demoInput();
    input.cases[0].evidenceKind = 'later_reconstruction';
    const run = make({ input });
    expect(run.cases[0].entry.evidenceClass.bars).toBe('later_reconstruction');
    expect(run.cases.every(c => c.outcome.status === 'not_observed')).toBe(true);
    expect(run.scope.trainingUse).toBe('unreviewed');
    expect(run.scope.model).toBeNull();
  });
});

describe('saved run contract and integrity', () => {
  it('replays identically, owns its snapshot, and fingerprints evidence/config changes', () => {
    const input = demoInput();
    const first = make({ input });
    expect(make({ input })).toEqual(first);
    expect(verifyExperiment(first, provenance)).toBe(first);
    input.cases[0].rows[0].volume += 1;
    expect(first.input.cases[0].rows[0].volume).toBe(2000000);
    expect(make({ input }).fingerprint).not.toBe(first.fingerprint);
    expect(make({ candidate: 'baseline-control-v1' }).fingerprint).not.toBe(first.fingerprint);
    expect(make({ createdAt: '2026-11-10T12:00:00.000Z' }).fingerprint).toBe(first.fingerprint);
  });

  it.each(['summary', 'decision', 'evidence', 'hash', 'extra'])('rejects saved record tampering: %s', target => {
    const record = clone(make());
    if (target === 'summary') record.summary.changed = 0;
    if (target === 'decision') record.cases[0].candidate.decision = 'refused';
    if (target === 'evidence') record.input.cases[0].rows[0].rawClose = 1000;
    if (target === 'hash') record.recordHash = '0'.repeat(64);
    if (target === 'extra') record.performance = { annualReturn: 100 };
    expect(() => verifyExperiment(record, provenance)).toThrow(/integrity/);
  });

  it('rejects replay under a different implementation or Node version', () => {
    expect(() => verifyExperiment(make(), { ...provenance, sourceDigest: 'c'.repeat(64) })).toThrow(/different source/);
    expect(() => verifyExperiment(make(), { ...provenance, nodeVersion: 'v1' })).toThrow(/Node version/);
  });

  it('rejects unsupported fields, fake evidence classifications, and duplicate cases', () => {
    const cases = [
      x => { x.apiKey = 'not-a-secret'; },
      x => { x.cases[0].evidenceKind = 'contemporaneous'; },
      x => { x.cases.push(clone(x.cases[0])); },
      x => { x.cases[0].rows[0].rawClose = Infinity; },
      x => { x.cases[0].observedAt = '2026-10-09'; },
      x => { x.cases[0].observedAt = '2026-02-30T21:00:00.000Z'; },
      x => { x.cases[0].sourceMeta = { token: 'not-a-secret' }; },
      x => { x.cases[0].rows = Array(261).fill(x.cases[0].rows[0]); },
    ];
    for (const change of cases) { const input = demoInput(); change(input); expect(() => make({ input })).toThrow(); }
    expect(() => make({ candidate: 'unapproved-policy' })).toThrow(/candidate/);
  });
});

describe('results view and local runner', () => {
  it('renders stored decisions, escapes user text, and loads no scripts or remote assets', () => {
    const input = demoInput();
    input.title = '<img src="https://example.invalid/x" onerror="alert(1)">';
    const run = make({ input });
    const dom = new JSDOM(renderReport(run, ':root{}'));
    const doc = dom.window.document;
    expect(doc.querySelectorAll('article').length).toBe(run.summary.total);
    expect(doc.querySelectorAll('script,img,iframe,link').length).toBe(0);
    expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]').content).toContain("default-src 'none'");
    expect(doc.body.textContent).toContain(input.title);
    for (const [i, article] of [...doc.querySelectorAll('article')].entries()) {
      expect([...article.querySelectorAll('.comparison strong')].map(x => x.textContent)).toEqual([run.cases[i].baseline.decision, run.cases[i].candidate.decision]);
    }
    dom.window.close();
  });

  it('writes unique local outputs and verifies a saved record with network disabled', async () => {
    const out = await mkdtemp(path.join(tmpdir(), 'agent-workspace-test-'));
    const network = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('network forbidden'); });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const first = await main(['--demo', '--out', out]);
      const second = await main(['--demo', '--out', out]);
      expect(first.folder).not.toBe(second.folder);
      const stored = JSON.parse(await readFile(path.join(first.folder, 'run.json'), 'utf8'));
      expect(stored).toEqual(first.run);
      expect(stored.usage).toEqual({ modelRequests: 0, marketRequests: 0, databaseWrites: 0 });
      expect(stored.provenance.files.some(f => f.path === 'api/_utils/setupEvaluator/tfSetupV1.js')).toBe(true);
      expect(stored.provenance.files.some(f => f.path === 'src/utils/marketCalendar.js')).toBe(true);
      expect(stored.provenance.files.some(f => f.path === 'package-lock.json')).toBe(true);
      await main(['--verify', path.join(first.folder, 'run.json')]);
      expect(network).not.toHaveBeenCalled();
    } finally { await rm(out, { recursive: true, force: true }); }
  });

  it('rejects ambiguous commands before starting a run', () => {
    for (const args of [[], ['--demo', '--input', 'x'], ['--demo', '--candidate'], ['--demo', '--demo'], ['--verify', 'x', '--demo'], ['--live']]) expect(() => parseArgs(args)).toThrow();
    expect(parseArgs(['--demo'])).toEqual({ '--demo': true });
  });

  it('refuses oversized or malformed files without printing their contents', async () => {
    const folder = await mkdtemp(path.join(tmpdir(), 'agent-workspace-input-'));
    const file = path.join(folder, 'packet.json');
    try {
      await writeFile(file, 'PRIVATE_SENTINEL_NOT_JSON');
      await expect(readJson(file)).rejects.toThrow('Input must be valid JSON. File contents were not printed.');
      await writeFile(file, 'x'.repeat(5 * 1024 * 1024 + 1));
      await expect(readJson(file)).rejects.toThrow('5 MiB');
    } finally { await rm(folder, { recursive: true, force: true }); }
  });
});
