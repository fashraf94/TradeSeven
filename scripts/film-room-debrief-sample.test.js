// scripts/film-room-debrief-sample.test.js
//
// Film Room D2 item 9 — THE SAMPLE PACK (D2 spec §11; DW-12), on FAKES ONLY: the tape's in-memory Firestore with the Sep
// 23 day written by the real close-pass writer, a fake model call, a temporary output directory. No real call, no key,
// no production read. It reads the owner's days the way the pass does, runs both models, writes one JSON and one
// Markdown file, stops before the estimated total passes $2, never writes Firestore, never prints a key, a token or an id.

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSample, estimateCallUsd, recentTapeDates, argsOf, markdownOf, SAMPLE_CAP_USD, SAMPLE_OUT_DIR } from './film-room-debrief-sample.mjs';
import { buildDayDigest } from '../api/_utils/filmRoom/dayDigest.js';
import { buildDebriefPrompt } from '../api/_utils/filmRoom/debriefPrompt.js';
import { sep23Day, SEP23_NIGHT } from '../api/_utils/filmTape/__fixtures__/screenFixtures.js';
import { seedDay, OWNER } from '../api/_utils/filmTape/__fixtures__/tapeFixtures.js';
import { makeTapeDb } from '../api/_utils/filmTape/__fixtures__/tapeFirestore.js';
import { writeTapeDay } from '../api/_utils/filmTape/writeTapeDay.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const D = '2026-09-23';
const AFTER = Date.parse('2026-09-24T12:00:00.000Z');   // the morning after Sep 23's close pass
let BASE; let BATTLE_ID;
beforeAll(async () => {
  const fx = await sep23Day();
  const store = seedDay({}, fx);
  for (const v of fx.intradayViews || []) store[`agentBattles/${fx.battleId}/intradayViews/${v.id}`] = { evaluatedAt: v.evaluatedAt, ownerId: OWNER };
  const t = makeTapeDb(store);
  await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: SEP23_NIGHT });
  BASE = Object.fromEntries(t.store.entries());
  BATTLE_ID = fx.battleId;
});
const dirs = [];
afterEach(() => { while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true }); });
const outDir = () => { const d = mkdtempSync(path.join(tmpdir(), 'debrief-sample-')); dirs.push(d); return d; };
/** The Sep 23 world, every write refused (a write would throw — and none must happen), plus another owner's copy. */
function world() {
  const initial = structuredClone(BASE);
  initial['agentBattles/b-other'] = { ...structuredClone(BASE[`agentBattles/${BATTLE_ID}`]), ownerId: 'owner-2' };
  initial[`agentBattles/b-other/tape/${D}`] = { ...structuredClone(BASE[`agentBattles/${BATTLE_ID}/tape/${D}`]), battleId: 'b-other', ownerId: 'owner-2' };
  return makeTapeDb(initial, { hooks: { beforeWrite: (op, p) => { throw new Error(`the sample pack wrote ${op} ${p}`); } } });
}
const fakeCall = ({ cost = 0.004 } = {}) => {
  const f = { asked: [] };
  f.call = async (req) => {
    f.asked.push(req.model);
    const lines = req.model === 'claude-sonnet-5-5'
      ? [{ swap: 's1', text: "That wasn't my call: the stall rule took MSFT." }, { swap: 's2', text: 'PLTR held, so DE went out on my plan.' }]
      : [{ swap: 's2', text: 'Out at 4 PM.' }];
    return { ok: true, output: { lines }, usage: { input: 1500, output: 60 }, model: req.model, attempts: 1, costUsd: cost, stopReason: 'end_turn' };
  };
  return f;
};
const resolveAttribution = async (_db, b) => b.agentId;

describe('the pack (§11): both models, one JSON file and one Markdown file, local only', () => {
  it('reads the owner\'s written days the way the pass does — another owner\'s never — and runs BOTH models on each', async () => {
    const t = world();
    const f = fakeCall();
    const lines = [];
    const { report, files } = await runSample({ db: t.db, ownerId: OWNER, days: 1, nowMs: AFTER, call: f.call, resolveAttribution, outDir: outDir(), log: (...a) => lines.push(a.join(' ')) });
    expect(f.asked).toEqual(['claude-sonnet-5-5', 'claude-haiku-5-5']);
    expect(report.days.map((d) => [d.etDate, d.battle, d.swaps.length])).toEqual([[D, 'battle 1', 3]]);
    expect(t.readLog.filter((p) => p.includes('b-other'))).toEqual([]);
    expect(t.writeLog).toEqual([]);
    expect(existsSync(files.json) && existsSync(files.md)).toBe(true);
    expect(path.dirname(files.json)).toBe(path.dirname(files.md));
  });
  it('each swap: its fact, and each model\'s line or drop reason; each call: its cost', async () => {
    const { report, files } = await runSample({ db: world().db, ownerId: OWNER, days: 1, nowMs: AFTER, call: fakeCall().call, resolveAttribution, outDir: outDir(), log: () => {} });
    const [s1, s2, s3] = report.days[0].swaps;
    expect(s1.fact).toBe('12:45 PM · the stall rule · MSFT → CRWD · sold at 498.79');
    expect(s1.models).toEqual({ 'claude-sonnet-5-5': { line: "That wasn't my call: the stall rule took MSFT." }, 'claude-haiku-5-5': { none: true } });
    expect(s2.models).toEqual({ 'claude-sonnet-5-5': { line: 'PLTR held, so DE went out on my plan.' }, 'claude-haiku-5-5': { dropped: 'digit' } });
    expect(s3.models['claude-sonnet-5-5']).toEqual({ none: true });
    expect(report.days[0].calls.map((c) => [c.model, c.ok, c.costUsd])).toEqual([['claude-sonnet-5-5', true, 0.004], ['claude-haiku-5-5', true, 0.004]]);
    expect(report.spentUsd).toBe(0.008);
    expect(JSON.parse(readFileSync(files.json, 'utf8'))).toEqual(report);
    const md = readFileSync(files.md, 'utf8');
    expect(md).toBe(markdownOf(report));
    expect(md).toContain('| s2 | 2:00 PM · your agent · DE → PLTR · sold at 468.43 | “PLTR held, so DE went out on my plan.” | dropped: digit |');
  });
  it('a model that fails: its reason on every swap of that day', async () => {
    const call = async (req) => (req.model === 'claude-haiku-5-5' ? { ok: false, reason: 'model_error_529', usage: null, costUsd: null, attempts: 2 } : fakeCall().call(req));
    const { report } = await runSample({ db: world().db, ownerId: OWNER, days: 1, nowMs: AFTER, call, resolveAttribution, write: false, log: () => {} });
    expect(report.days[0].swaps.map((s) => s.models['claude-haiku-5-5'])).toEqual([{ failed: 'model_error_529' }, { failed: 'model_error_529' }, { failed: 'model_error_529' }]);
  });
  it('the output directory is scripts/output/, which git ignores', () => {
    expect(path.relative(path.join(HERE, '..'), SAMPLE_OUT_DIR).replace(/\\/g, '/')).toBe('scripts/output');
    expect(readFileSync(path.join(HERE, '..', '.gitignore'), 'utf8').split(/\r?\n/)).toContain('scripts/output/');
  });
});

describe('the $2 stop (DW-12)', () => {
  it(`the cap is $${SAMPLE_CAP_USD}`, () => { expect(SAMPLE_CAP_USD).toBe(2); });
  it('a call whose estimate would carry the total past the cap is never made — the pack stops there and says so', async () => {
    const t = world();
    const tape = BASE[`agentBattles/${BATTLE_ID}/tape/${D}`];
    const prompt = buildDebriefPrompt(buildDayDigest({ tape, battle: { id: BATTLE_ID, ...BASE[`agentBattles/${BATTLE_ID}`] } }).digest);
    const est = estimateCallUsd('claude-sonnet-5-5', prompt);
    const haikuEst = estimateCallUsd('claude-haiku-5-5', prompt);
    const cap = est + haikuEst / 2;      // the first call fits; the second's estimate would carry the total past the cap
    const f = fakeCall({ cost: est });   // the worst case: each call costs its full estimate
    const { report } = await runSample({ db: t.db, ownerId: OWNER, days: 1, nowMs: AFTER, call: f.call, resolveAttribution, capUsd: cap, write: false, log: () => {} });
    expect([f.asked, report.stopped, report.calls]).toEqual([['claude-sonnet-5-5'], true, 1]);
    expect(report.spentUsd).toBeLessThanOrEqual(cap);
    // and with room for both: both are made, nothing stopped
    const g = fakeCall({ cost: est });
    const both = await runSample({ db: world().db, ownerId: OWNER, days: 1, nowMs: AFTER, call: g.call, resolveAttribution, capUsd: est * 2 + haikuEst, write: false, log: () => {} });
    expect([g.asked.length, both.report.stopped]).toEqual([2, false]);
  });
  it('the estimate: the prompt\'s bytes as tokens (three to a token) and the full 800 output tokens, at list price', () => {
    const prompt = { system: 'x'.repeat(2999), user: '', schema: {} };   // 2999 + 2 bytes → 1001 tokens
    expect(estimateCallUsd('claude-sonnet-5-5', prompt)).toBeCloseTo((1001 * 2 + 800 * 10) / 1e6, 12);
    expect(estimateCallUsd('claude-haiku-5-5', prompt)).toBeCloseTo((1001 * 0.1 + 800 * 0.5) / 1e6, 12);
  });
});

describe('never a write, never a key, a token or an id', () => {
  it('the script names no Firestore write in its code', () => {
    const src = readFileSync(path.join(HERE, 'film-room-debrief-sample.mjs'), 'utf8').replace(/\/\/[^\n]*/g, '');
    expect(src).not.toMatch(/\.(set|create|update|delete|add)\s*\(|\bbatch\s*\(|runTransaction|bulkWriter/);
  });
  it('the console and both files hold no key, no uid, no battle id and no tape row key', async () => {
    process.env.CLAUDE_API_KEY = 'sentinel-key-not-real-0042';
    const lines = [];
    const { files } = await runSample({ db: world().db, ownerId: OWNER, days: 1, nowMs: AFTER, call: fakeCall().call, resolveAttribution, outDir: outDir(), log: (...a) => lines.push(a.join(' ')) });
    const keys = BASE[`agentBattles/${BATTLE_ID}/tape/${D}`].actions.map((a) => a.key);
    const texts = { console: lines.join('\n'), json: readFileSync(files.json, 'utf8'), md: readFileSync(files.md, 'utf8') };
    for (const [where, text] of Object.entries(texts)) {
      for (const s of ['sentinel-key-not-real-0042', OWNER, BATTLE_ID, 'b-other', BASE[`agentBattles/${BATTLE_ID}`].agentId, ...keys]) expect(text.includes(s), `${where}: ${s}`).toBe(false);
    }
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0].slice(lines[0].indexOf(' ') + 1))).toEqual({ days: 1, calls: 2, spentUsd: 0.008, stopped: false });
  });
  it('no owner: refused before any read', async () => {
    const t = world();
    await expect(runSample({ db: t.db, ownerId: '', call: fakeCall().call, write: false, log: () => {} })).rejects.toThrow(/--owner/);
    expect(t.readLog).toEqual([]);
  });
});

describe('the days and the arguments', () => {
  it('the most recent session days whose close pass has finished, newest first', () => {
    expect(recentTapeDates(AFTER, 3)).toEqual(['2026-09-23', '2026-09-22', '2026-09-21']);
    expect(recentTapeDates(Date.parse('2026-09-24T02:16:00.000Z'), 1)).toEqual(['2026-09-22']);   // Sep 23's pass still running
    expect(recentTapeDates(Date.parse('2026-09-24T02:25:01.000Z'), 1)).toEqual(['2026-09-23']);   // past its 300 s
    expect(recentTapeDates(Date.parse('2026-09-27T15:00:00.000Z'), 2)).toEqual(['2026-09-25', '2026-09-24']);   // a Sunday
  });
  it('--owner <uid> --days <n> (1 to 20, else 3)', () => {
    expect(argsOf(['--owner', 'u1', '--days', '5'])).toEqual({ ownerId: 'u1', days: 5 });
    expect(argsOf(['--owner', 'u1'])).toEqual({ ownerId: 'u1', days: 3 });
    expect(argsOf(['--days', '99'])).toEqual({ ownerId: null, days: 3 });
  });
});
