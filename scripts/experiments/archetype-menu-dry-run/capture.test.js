import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { buildArchetypeCandidateMenu } from '../../../api/_utils/archetypeCandidateMenu.js';
import { BATTLE_FIELDS, ROOT, collectSnapshot, digest, makeReader, outsideDirectory, plain,
  saveSnapshot, serviceAccount, timeMs, validateRankings, verifySnapshot } from './capture.mjs';

const dirs = [];
const temporary = () => { const dir = mkdtempSync(path.join(os.tmpdir(), 'menu-capture-test-')); dirs.push(dir); return dir; };
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const stamp = { seconds: 1792418700, nanoseconds: 123456789 };
const snapshotHeads = () => ({
  rankings: { updateTime: stamp, data: { computedAt: stamp, mode: 'intraday', stocks: [{ symbol: 'A', baggerBombFit: 50 }] } },
  context: { updateTime: stamp, data: { regime: 'bull' } },
});
const now = () => 1792418700000;
const options = { projectId: 'synthetic-test-only', code: { head: 'test' }, now };
const reader = () => ({ heads: vi.fn(async () => snapshotHeads()), battles: vi.fn(async () => ({ docs: [], readTime: stamp })) });

describe('Stage A read-only capture', () => {
  it('uses only getAll and a projected active-battle query', async () => {
    const calls = [];
    const docs = name => ({ exists: true, updateTime: stamp, readTime: stamp,
      data: () => name === 'stockRankings' ? snapshotHeads().rankings.data : snapshotHeads().context.data });
    const db = {
      collection(name) {
        calls.push(['collection', name]);
        if (name === 'indexIntelligence') return { doc(id) { return id; } };
        expect(name).toBe('agentBattles');
        return { where(...condition) {
          calls.push(['where', ...condition]);
          return { select(...fields) {
            calls.push(['select', ...fields]);
            return { async get() { return { docs: [{ id: 'tiered', updateTime: stamp, data: () => ({ status: 'active', portfolio: {} }) }], readTime: stamp }; } };
          } };
        } };
      },
      async getAll(...refs) { calls.push(['getAll', ...refs]); return refs.map(docs); },
    };
    const result = await collectSnapshot(makeReader(db), options);
    expect(calls.filter(c => c[0] === 'getAll')).toHaveLength(2);
    expect(calls).toContainEqual(['where', 'status', '==', 'active']);
    expect(calls).toContainEqual(['select', ...BATTLE_FIELDS]);
    expect(BATTLE_FIELDS).not.toContain('agentContext');
    expect(result.payload.battles.map(b => b.id)).toEqual(['tiered']);
    expect(result.payload.battleReadTime).toEqual(stamp);
    verifySnapshot(result);
  });

  it('retries if either feed changes during battle reads, then preserves the stable observation', async () => {
    const r = reader();
    const changed = snapshotHeads();
    changed.context.updateTime = { ...stamp, nanoseconds: 222222222 };
    r.heads.mockResolvedValueOnce(snapshotHeads()).mockResolvedValueOnce(changed);
    const result = await collectSnapshot(r, options);
    expect(r.battles).toHaveBeenCalledTimes(2);
    expect(result.payload.rankings.updateTime).toEqual(stamp);
  });

  it('fails after three changing-feed attempts without saving a partial result', async () => {
    const r = reader();
    let version = 0;
    r.heads.mockImplementation(async () => {
      const h = snapshotHeads(); h.rankings.updateTime = { ...stamp, nanoseconds: version++ }; return h;
    });
    await expect(collectSnapshot(r, options)).rejects.toThrow('three capture attempts');
    expect(r.battles).toHaveBeenCalledTimes(3);
  });

  it('keeps tiered and absent-mode books, excluding explicit other modes', async () => {
    const r = reader();
    r.battles.mockResolvedValue({ readTime: stamp, docs: [
      { id: 'absent', data: { status: 'active' } },
      { id: 'tiered', data: { status: 'active', gameMode: 'baggerbomb_agent' } },
      { id: 'flat6', data: { status: 'active', gameMode: 'baggerbomb_tournament' } },
    ] });
    const result = await collectSnapshot(r, options);
    expect(result.payload.battles.map(b => b.id)).toEqual(['absent', 'tiered']);
    expect(result.payload.excludedOtherModeCount).toBe(1);
  });

  it('preserves the first book for a rebuild and rejects tampered snapshots', async () => {
    const directory = temporary();
    const first = await collectSnapshot(reader(), options);
    const saved = saveSnapshot(first, directory);
    const bytes = readFileSync(saved.file, 'utf8');
    const later = structuredClone(first);
    later.payload.battles = [{ id: 'later-book', data: {} }];
    later.payload.startedAt = '2026-10-19T15:00:00Z';
    later.sha256 = digest(later.payload);
    expect(saveSnapshot(later, directory).saved).toBe(false);
    expect(readFileSync(saved.file, 'utf8')).toBe(bytes);
    expect(readdirSync(directory)).toHaveLength(1);
    later.payload.battles = [];
    expect(() => saveSnapshot(later, directory)).toThrow('checksum');
  });

  it('rejects malformed ranking data and captures precise Firestore timestamps', () => {
    const ts = { ...stamp, toMillis: () => stamp.seconds * 1000 + stamp.nanoseconds / 1e6 };
    expect(plain(ts)).toEqual(stamp);
    expect(timeMs(plain(ts))).toBe(ts.toMillis());
    expect(() => validateRankings({ stocks: [] })).toThrow('computedAt');
    expect(() => validateRankings({ computedAt: stamp, stocks: [{ symbol: 'A' }, { symbol: 'A' }] })).toThrow('duplicate');
    expect(() => validateRankings({ computedAt: stamp, stocks: [{ symbol: 'A', fundamentalScore: 'bad' }] })).toThrow('non-numeric');
  });

  it('refuses checkout output paths including symlink aliases', () => {
    expect(() => outsideDirectory(path.join(ROOT, 'private-capture'))).toThrow('outside');
    const directory = temporary();
    const link = path.join(directory, 'checkout-alias');
    symlinkSync(ROOT, link, 'junction');
    expect(() => outsideDirectory(path.join(link, 'private-capture'))).toThrow('outside');
  });

  it('recognizes absent and malformed credential configuration without exposing values', () => {
    expect(serviceAccount({})).toBeNull();
    expect(() => serviceAccount({ FIREBASE_ADMIN_CREDENTIALS: 'private-secret-invalid' })).toThrow('values are not logged');
    expect(serviceAccount({ FIREBASE_PROJECT_ID: 'demo', FIREBASE_CLIENT_EMAIL: 'demo', FIREBASE_PRIVATE_KEY: 'a\\nb' }).private_key).toBe('a\nb');
  });

  it('runs the complete offline CLI without credentials and leaves ordinary imports dark', async () => {
    const directory = temporary();
    saveSnapshot(await collectSnapshot(reader(), options), directory);
    const run = spawnSync(process.execPath, ['scripts/experiments/archetype-menu-dry-run/run.mjs',
      'analyze', '--input', directory, '--out', directory], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
    expect(run.status, run.stderr).toBe(0);
    const report = JSON.parse(readFileSync(path.join(directory, readdirSync(directory).find(f => f.startsWith('comparison-') && f.endsWith('.json'))), 'utf8'));
    expect(report.instants[0].controls).toHaveLength(6);
    expect(report.analysisCode.sourceHashes['api/_utils/archetypeCandidateMenu.js']).toMatch(/^[a-f0-9]{64}$/);
    expect(buildArchetypeCandidateMenu({ archetype: 'analyst', rankings: [{ symbol: 'A' }] })).toBeNull();
  }, 65000);
});
