// BaggerBomb stock thresholds v2 pilot scripts: the control switch (dry run by
// default, the exact document, owner ids only from argv) and the read-only
// live-battle verifier. Real modules; the store is an in-memory double.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseArgs, buildControlDocument, run as runControl } from './stock-threshold-pilot-control.mjs';
import { run as runVerify, verifyBattle } from './stock-threshold-pilot-verify.mjs';
import { validStockAdmissionControl, stockAdmissionSelects } from '../api/_utils/stockThresholdPolicyRegistry.js';
import { STOCK_MODEL } from '../src/utils/stockThresholdModel.js';
import { correctedStockBattle, stockWriterDb, STOCK_TEST_NOW } from '../api/_utils/__fixtures__/stockThresholdHarness.js';
import { correctedScorePatch, scoreCorrectedPosition } from '../api/_utils/stockThresholdAdmission.js';

const oldKey = process.env.EODHD_API_KEY;
beforeAll(() => { process.env.EODHD_API_KEY = 'isolated-key'; });
afterAll(() => { if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; });

function controlStore(initial) {
  let doc = initial ? structuredClone(initial) : undefined; const writes = []; const reads = [];
  return { writes, reads, get doc() { return doc; }, db: { doc: path => ({ get: async () => { reads.push(path); return { exists: doc !== undefined, data: () => structuredClone(doc) }; }, set: async v => { writes.push([path, structuredClone(v)]); doc = structuredClone(v); } }) } };
}

describe('scripts/stock-threshold-pilot-control.mjs', () => {
  it('parses only the three actions; enable needs owners; show is read-only', () => {
    expect(parseArgs(['enable', '--owner', 'a', '--owner', 'b', '--owner', 'a'])).toEqual({ action: 'enable', ownerIds: ['a', 'b'], apply: false });
    expect(parseArgs(['disable', '--apply'])).toEqual({ action: 'disable', ownerIds: [], apply: true });
    for (const bad of [[], ['all'], ['enable'], ['enable', '--owner'], ['disable', '--owner', 'a'], ['show', '--apply'], ['enable', '--owner', 'a', '--force']]) expect(() => parseArgs(bad), JSON.stringify(bad)).toThrow();
  });
  it('enable builds the exact schema-2 allowlist document the server accepts; disable closes it; the epoch always advances', () => {
    const on = buildControlDocument(null, { action: 'enable', ownerIds: ['owner-a'] });
    expect(on).toEqual({ schemaVersion: 2, enabled: true, epoch: 1, model: { ...STOCK_MODEL }, audience: { mode: 'allowlist', ownerIds: ['owner-a'] } });
    expect(validStockAdmissionControl(on)).toBe(true); expect(stockAdmissionSelects(on, 'owner-a')).toBe(true); expect(stockAdmissionSelects(on, 'owner-b')).toBe(false);
    const off = buildControlDocument(on, { action: 'disable' });
    expect(off).toMatchObject({ enabled: false, epoch: 2, audience: { mode: 'allowlist', ownerIds: ['owner-a'] } });
    expect(validStockAdmissionControl(off)).toBe(false);
    expect(buildControlDocument({ epoch: 7 }, { action: 'enable', ownerIds: ['x'] }).epoch).toBe(8);
  });
  it('a dry run prints the exact document and writes nothing; --apply writes it and reads it back', async () => {
    const s = controlStore(); const log = vi.fn();
    const dry = await runControl(['enable', '--owner', 'owner-a'], { db: s.db, log });
    expect(dry.written).toBe(false); expect(s.writes).toEqual([]);
    expect(log.mock.calls.flat().join('\n')).toContain(JSON.stringify(dry.next, null, 2));
    const wet = await runControl(['enable', '--owner', 'owner-a', '--apply'], { db: s.db, log: () => {} });
    expect(wet.written).toBe(true); expect(s.writes).toEqual([['stockThresholdControl/admission', wet.next]]);
    const off = await runControl(['disable', '--apply'], { db: s.db, log: () => {} });
    expect(off.next).toMatchObject({ enabled: false, epoch: 2 }); expect(validStockAdmissionControl(s.doc)).toBe(false);
    const show = await runControl(['show'], { db: s.db, log: () => {} });
    expect(show.written).toBe(false); expect(s.writes).toHaveLength(2);
  });
  it('a write that reads back differently is an error, never "Written" (review mutation lens S3)', async () => {
    const s = controlStore(); const set = s.db.doc('stockThresholdControl/admission').set;
    const db = { doc: path => ({ ...s.db.doc(path), set: v => set({ ...v, epoch: v.epoch + 40 }) }) };
    await expect(runControl(['enable', '--owner', 'owner-a', '--apply'], { db, log: () => {} })).rejects.toThrow('read-back differs');
  });
  it('owner ids come only from the command line: the script writes no file', () => {
    const source = readFileSync(new URL('./stock-threshold-pilot-control.mjs', import.meta.url), 'utf8');
    expect(source).not.toMatch(/writeFile|appendFile|createWriteStream/);
    expect(source).not.toMatch(/ownerIds:\s*\[\s*['"]/);
  });
});

describe('scripts/stock-threshold-pilot-verify.mjs', () => {
  async function committed() {
    const { battle, inputs } = await correctedStockBattle({ fill: 100, cpuFill: 120 });
    const prices = { AAPL: { current: 103.5, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
    const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
    const h = stockWriterDb({ [`agentBattles/${battle.id}`]: battle, ...inputs });
    await h.db.doc(`agentBattles/${battle.id}`).update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW));
    h.writes.length = 0;
    return { battle, h };
  }
  it('prints receipt, six targets, committed context and points for both sides; both sides agree; inputs replay; nothing is written', async () => {
    const { battle, h } = await committed(); const log = vi.fn();
    const report = await runVerify(battle.id, { db: h.db, log });
    expect(report).toMatchObject({ route: 'corrected', valid: true, replay: { status: 'ok' } });
    const agent = report.positions.find(p => p.side === 'agent');
    expect(agent).toMatchObject({ symbol: 'AAPL', receiptPct: '2.000000', fill: 100, fillQuoteAt: '2026-10-14T13:47:00.000Z', context: { currentPrice: 103.5, crossedTiers: ['bagger', 'doubleBagger'] } });
    expect(Object.keys(agent.targets)).toEqual(['bagger', 'doubleBagger', 'tenBagger', 'bust', 'crash', 'meltdown']);
    expect(agent.targets.bagger).toBe(100 * (1 + 1 * 2 / 100));
    expect(report.sides.agent).toMatchObject({ stored: h.store.get(`agentBattles/${battle.id}`).scoreState.currentScore, agrees: true });
    expect(report.sides.cpu).toMatchObject({ agrees: true, banked: 0 });
    // Neither side holds crypto, so each stored active score is exactly its recomputed stock points.
    expect(report.sides.agent).toMatchObject({ holdsCrypto: false, cryptoRemainder: 0 }); expect(report.sides.cpu).toMatchObject({ holdsCrypto: false, cryptoRemainder: 0 });
    expect(log.mock.calls.flat().join('\n')).toContain('AGREES');
    expect(h.writes).toEqual([]);
  });
  it('a corrupted input or frame is reported, not hidden', async () => {
    const { battle, h } = await committed();
    h.store.get(battle.portfolio.star[0].stockThresholdReceipt.inputRef).general.Code = 'WRONG';
    expect((await runVerify(battle.id, { db: h.db, log: () => {} })).replay).toEqual({ status: 'failed', reason: 'immutable_observation_corrupt' });
    const live = { id: battle.id, ...h.store.get(`agentBattles/${battle.id}`) }; live.scoreState.currentScore = 999;
    const r = verifyBattle(live);
    expect(r.valid).toBe(false); expect(r.sides.agent.agrees).toBe(false);
    expect(verifyBattle({ id: 'legacy', status: 'active', scoring: {} }).lines.at(-1)).toContain('not a measured-model battle');
  });
  it('a stored score that is self-consistent but not the recomputed stock points is CHECK on a side without crypto; a crypto side reports the remainder (review mutation lens S5)', async () => {
    const { battle, h } = await committed();
    const live = { id: battle.id, ...h.store.get(`agentBattles/${battle.id}`) };
    live.scoreState.activeScore += 5; live.scoreState.currentScore += 5; live.scoreState.opponentScore += 5;
    const r = verifyBattle(live);
    expect(r.sides.agent).toMatchObject({ holdsCrypto: false, cryptoRemainder: 5, agrees: false }); expect(r.sides.cpu).toMatchObject({ cryptoRemainder: 5, agrees: false });
    expect(r.lines.join(' | ')).toContain('no crypto: remainder 5 must be 0');
    live.portfolio.support = [...(live.portfolio.support || []), { symbol: 'BTC', isCrypto: true, baseATR: 5 }];
    const withCrypto = verifyBattle(live);
    expect(withCrypto.sides.agent).toMatchObject({ holdsCrypto: true, cryptoRemainder: 5, agrees: true });
  });
});
