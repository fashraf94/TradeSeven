// scripts/reset-failure-built-insight.test.js
//
// Package P-RESET — the one-off reset of the failure-built paragraphs. Importing
// the module runs nothing (main() is guarded behind the CLI entrypoint and loads
// its credentials lazily); that passing load is the BUILD_RULES §4
// dependency-surface guard for this script. The fake below projects select() the
// way Firestore does and applies the real delete sentinel, so a field missing
// from the read or a wrong write shows up as a wrong row.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'acorn';
import { FieldValue } from 'firebase-admin/firestore';
import {
  Refusal, RESET_REASON, RUNS_ROOT, computeCensus, countBattleHolds, failureLine, isAlreadyReset,
  isWeekendInNewYork, parseArgs, renderCensus, runApply, runCensus, runPlan, runRestore, selectionRule,
} from './reset-failure-built-insight.mjs';

// A backup that lands torn is the one failure a real disk can give and a temp
// folder cannot, so the read-back alone is faked, and only when a row asks.
const tornBackup = vi.hoisted(() => ({ on: false }));
vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal();
  return {
    ...fs,
    readFileSync: (file, ...rest) => (tornBackup.on && String(file).endsWith('backup.local.json')
      ? Buffer.from('torn')
      : fs.readFileSync(file, ...rest)),
  };
});

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(HERE, 'reset-failure-built-insight.mjs'), 'utf8');

const PLAN_TIME = new Date('2026-10-31T15:00:00.000Z');
const SATURDAY = new Date('2026-10-31T16:00:00.000Z');
const SUNDAY = new Date('2026-11-01T16:00:00.000Z');
const MONDAY = new Date('2026-11-02T16:00:00.000Z');

const SECRET_ID = 'agentSECRETID';
const SECRET_TEXT = 'SECRETPARAGRAPHWORDS';
const FAILED_TEXT = `Most of my reflections failed, so I trade on instinct. ${SECRET_TEXT}`;
const SERIALISED_EMPTY = '""';
const DOSSIER = { selection: [{ id: 'disc_1', text: `${SECRET_TEXT} selection` }], execution: [] };

const isDeleteSentinel = (v) => FieldValue.delete().isEqual(v);
const hashOf = (s) => createHash('sha256').update(s).digest('hex');

// The learning history the reset must never touch.
const history = {
  memory: [{ gameId: 'g1', lesson: 'Stay with winners.' }],
  lessons: [{ id: 'l1', consumed: false }],
  evolutionCycle: 3,
  evolutionTimeline: [{ id: 'evo_1', metadata: { disciplinesCount: { selection: 2, execution: 1 } } }],
  lastConsolidatedGamesPlayed: 15,
  stats: { gamesPlayed: 20, wins: 11 },
  name: 'Aurora',
};

// One family under (b), one agent under (a), and agents outside the set.
const fleet = () => ({
  [`${SECRET_ID}-ranked`]: { ...history, ownerId: 'o1', consolidatedInsight: FAILED_TEXT, disciplines: DOSSIER, pendingConsolidation: true, activeBattleId: null },
  [`${SECRET_ID}-training`]: { ...history, stats: { gamesPlayed: 0 }, ownerId: 'o1', isTrainingClone: true, rankedAgentId: `${SECRET_ID}-ranked`, consolidatedInsight: FAILED_TEXT, disciplines: DOSSIER, pendingConsolidation: false, activeBattleId: null },
  [`${SECRET_ID}-casual`]: { ...history, stats: { gamesPlayed: 0 }, ownerId: 'o1', isCasualClone: true, rankedAgentId: `${SECRET_ID}-ranked`, consolidatedInsight: `An older copy: the reflection call failed. ${SECRET_TEXT}`, disciplines: DOSSIER, pendingConsolidation: false, activeBattleId: null },
  [`${SECRET_ID}-serialised`]: { ...history, stats: { gamesPlayed: 5 }, ownerId: 'o2', consolidatedInsight: SERIALISED_EMPTY, activeBattleId: null },
  [`${SECRET_ID}-outsider`]: { ...history, ownerId: 'o3', consolidatedInsight: `Patience pays. ${SECRET_TEXT}`, disciplines: DOSSIER, activeBattleId: null },
  [`${SECRET_ID}-blank`]: { ...history, ownerId: 'o4', consolidatedInsight: '', activeBattleId: null },
  [`${SECRET_ID}-odd`]: { ...history, ownerId: 'o5', consolidatedInsight: 42, activeBattleId: null },
});
const SET_IDS = [`${SECRET_ID}-ranked`, `${SECRET_ID}-training`, `${SECRET_ID}-casual`, `${SECRET_ID}-serialised`];

function makeDb({ agents = fleet(), battles = [] } = {}) {
  const state = {
    agents: structuredClone(agents),
    agentBattles: Object.fromEntries(battles.map((b, i) => [`battle-${i}`, structuredClone(b)])),
  };
  const writes = [];
  const hooks = { beforeTransaction: null, onUpdate: null };
  let transactions = 0;
  const pick = (doc, fields) => {
    if (!fields) return structuredClone(doc);
    const out = {};
    for (const f of fields) {
      const [head, tail] = f.split('.');
      if (tail === undefined) { if (doc[head] !== undefined) out[head] = doc[head]; }
      else if (doc[head]?.[tail] !== undefined) out[head] = { ...out[head], [tail]: doc[head][tail] };
    }
    return structuredClone(out);
  };
  const query = (coll, filters = [], fields = null) => ({
    where: (field, op, value) => { expect(op).toBe('=='); return query(coll, [...filters, [field, value]], fields); },
    select: (...names) => query(coll, filters, names),
    get: async () => {
      const docs = Object.entries(state[coll] ?? {})
        .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
        .map(([id, d]) => ({ id, data: () => pick(d, fields) }));
      return { docs, empty: docs.length === 0, size: docs.length };
    },
  });
  const db = {
    collection: (coll) => ({
      ...query(coll),
      doc: (id) => ({
        coll, id,
        get: async () => {
          const d = state[coll]?.[id];
          return { id, exists: d !== undefined, data: () => structuredClone(d) };
        },
      }),
    }),
    runTransaction: async (fn) => {
      const n = transactions;
      transactions += 1;
      await hooks.beforeTransaction?.(n, state);
      const buffered = [];
      const result = await fn({
        get: (target) => target.get(),
        update: (ref, patch) => { hooks.onUpdate?.(ref); buffered.push([ref, patch]); },
      });
      for (const [ref, patch] of buffered) {
        writes.push({ id: ref.id, coll: ref.coll, patch });
        for (const [k, v] of Object.entries(patch)) {
          if (isDeleteSentinel(v)) delete state[ref.coll][ref.id][k];
          else state[ref.coll][ref.id][k] = v;
        }
      }
      return result;
    },
  };
  return { db, state, writes, hooks, transactionCount: () => transactions };
}

let runsRoot;
const quiet = () => {};
const noFence = async () => null;

beforeEach(() => { runsRoot = mkdtempSync(join(tmpdir(), 'insight-reset-test-')); });
afterEach(() => { rmSync(runsRoot, { recursive: true, force: true }); vi.restoreAllMocks(); });

let planTick = 0; // each plan is its own instant, so it gets its own run folder
const planOn = (db, over = {}) => runPlan({ db, now: new Date(PLAN_TIME.getTime() + (planTick += 1)), runsRoot, log: quiet, ...over });
const applyWith = (db, planned, over = {}) => runApply({
  db, planPath: planned.planPath, planSha256: planned.planSha256, go: true,
  assertEpochOpen: noFence, now: SATURDAY, runsRoot, log: quiet, ...over,
});
const planAndApply = async (db, over = {}) => applyWith(db, await planOn(db), over);
const backupOf = (result) => JSON.parse(readFileSync(result.backupPath, 'utf8'));

describe('the selection rule', () => {
  it('(a) is exactly the two-character serialised empty string', () => {
    expect(selectionRule('""')).toBe('a');
    expect(selectionRule(' "" ')).toBe(null);
    expect(selectionRule('""""')).toBe(null);
    expect(selectionRule("''")).toBe(null);
  });

  it('(b) needs both words, in any case, anywhere', () => {
    expect(selectionRule('Most of my reflections failed')).toBe('b');
    expect(selectionRule('REFLECTION generation FAILURE')).toBe('b');
    expect(selectionRule('it failed in a reflection')).toBe('b');
    expect(selectionRule('Most of my reflections were strong')).toBe(null);
    expect(selectionRule('I failed to hold')).toBe(null);
  });

  it('a paragraph matching neither is outside the set', () => {
    expect(selectionRule('Patience pays.')).toBe(null);
    expect(selectionRule('   ')).toBe(null);
  });

  it('empty and non-string are outside the set', () => {
    for (const v of ['', null, undefined, 42, true, {}, [], ['reflection failed']]) expect(selectionRule(v)).toBe(null);
  });
});

describe('the New York weekend', () => {
  it('turns at midnight Eastern, not UTC, on both sides of the weekend', () => {
    expect(isWeekendInNewYork(new Date('2026-10-31T03:59:00.000Z'))).toBe(false); // Friday 23:59 EDT
    expect(isWeekendInNewYork(new Date('2026-10-31T04:00:00.000Z'))).toBe(true);  // Saturday 00:00 EDT
    expect(isWeekendInNewYork(new Date('2026-11-02T04:59:00.000Z'))).toBe(true);  // Sunday 23:59 EST
    expect(isWeekendInNewYork(new Date('2026-11-02T05:00:00.000Z'))).toBe(false); // Monday 00:00 EST
    expect(isWeekendInNewYork(SATURDAY)).toBe(true);
    expect(isWeekendInNewYork(SUNDAY)).toBe(true);
    expect(isWeekendInNewYork(MONDAY)).toBe(false);
  });
});

describe('census (read-only, counts only)', () => {
  it('counts the set by rule, the clones, the flags and the distribution', async () => {
    const { db, writes, transactionCount } = makeDb();
    const c = await runCensus({ db, now: SATURDAY, log: quiet });
    expect(c).toMatchObject({
      agents: 7, holders: 5, inSet: 4, byRule: { a: 1, b: 3 }, outsideSet: 1, nonStringParagraph: 1,
      clones: 2, nonClones: 2, pendingConsolidation: 1, holdingDisciplines: 3, activeBattle: 0, alreadyReset: 0,
    });
    expect(c.gamesPlayed).toEqual({ 0: 2, 5: 1, 20: 1 });
    expect(writes).toEqual([]);
    expect(transactionCount()).toBe(0);
  });

  it('says what the ranked parent of each clone in the set holds', () => {
    const rows = [
      { id: 'p-set', consolidatedInsight: FAILED_TEXT },
      { id: 'p-empty', consolidatedInsight: '' },
      { id: 'p-other', consolidatedInsight: 'Patience pays.' },
      { id: 'c1', isTrainingClone: true, rankedAgentId: 'p-set', consolidatedInsight: FAILED_TEXT },
      { id: 'c2', isCasualClone: true, rankedAgentId: 'p-set', consolidatedInsight: 'a reflection failed' },
      { id: 'c3', isTrainingClone: true, rankedAgentId: 'p-empty', consolidatedInsight: FAILED_TEXT },
      { id: 'c4', isTrainingClone: true, rankedAgentId: 'p-other', consolidatedInsight: FAILED_TEXT },
      { id: 'c5', isCasualClone: true, rankedAgentId: 'p-gone', consolidatedInsight: FAILED_TEXT },
      { id: 'c6', isTrainingClone: true, consolidatedInsight: FAILED_TEXT },
    ];
    expect(computeCensus(rows, new Set(), SATURDAY.getTime()).cloneParents).toEqual({
      inSet: 2, empty: 1, outsideSet: 1, missing: 1, noParentId: 1, sameParagraph: 1,
    });
  });

  it('counts an active battle by the battle record and by the agent pointer, and previews a refusal', () => {
    const rows = [
      { id: 'a', consolidatedInsight: FAILED_TEXT },
      { id: 'b', consolidatedInsight: FAILED_TEXT, activeBattleId: 'x' },
      { id: 'c', consolidatedInsight: FAILED_TEXT },
    ];
    const c = computeCensus(rows, new Set(['a']), SATURDAY.getTime());
    expect(c.activeBattle).toBe(2);
    expect(c.battleHolds.blocked).toBe(2);
  });

  it('after a clean apply the set is empty and the census says so', async () => {
    const { db } = makeDb();
    await planAndApply(db);
    const c = await runCensus({ db, now: SUNDAY, log: quiet });
    expect(c).toMatchObject({ inSet: 0, alreadyReset: 4, holders: 1, outsideSet: 1, holdingDisciplines: 0 });
  });

  it('the render carries every number the brief names', () => {
    const c = computeCensus([{ id: 'a', consolidatedInsight: '""', stats: { gamesPlayed: 7 } }], new Set(), SATURDAY.getTime());
    const text = renderCensus(c, { readAt: 'now' });
    expect(text).toContain('In the set: 1   by (a): 1   by (b): 0   outside the set: 0');
    expect(text).toContain('7: 1');
  });
});

describe('plan (read-only, writes one local file)', () => {
  it('writes each agent in the set with its hash, disciplines and flag, and writes nothing to Firestore', async () => {
    const { db, writes, transactionCount } = makeDb();
    const planned = await planOn(db);
    const plan = JSON.parse(readFileSync(planned.planPath, 'utf8'));
    expect(plan.entries.map((e) => e.id).sort()).toEqual([...SET_IDS].sort());
    expect(plan.entries.find((e) => e.id === `${SECRET_ID}-ranked`)).toEqual({
      id: `${SECRET_ID}-ranked`, isClone: false, insightSha256: hashOf(FAILED_TEXT), disciplines: DOSSIER, pendingConsolidation: true,
    });
    expect(plan.entries.find((e) => e.id === `${SECRET_ID}-training`).isClone).toBe(true);
    expect(plan.entries.find((e) => e.id === `${SECRET_ID}-casual`).isClone).toBe(true);
    expect(plan.outsideSet.map((e) => e.id)).toEqual([`${SECRET_ID}-outsider`]);
    expect(writes).toEqual([]);
    expect(transactionCount()).toBe(0);
  });

  it('prints the counts and the SHA-256 of the file as it landed', async () => {
    const { db } = makeDb();
    const log = vi.fn();
    const planned = await planOn(db, { log });
    expect(planned.planSha256).toBe(hashOf(readFileSync(planned.planPath)));
    expect(log.mock.calls[0][0]).toContain(`Plan SHA-256: ${planned.planSha256}`);
    expect(log.mock.calls[0][0]).toContain('In the set: 4 (clones 2, non-clones 2)   outside the set, never touched: 1');
  });

  it('writes under insight-reset-<time>/ in the run root, and defaults that root to growth-replay-runs in the home folder', async () => {
    const { db } = makeDb();
    const planned = await planOn(db);
    expect(dirname(dirname(planned.planPath))).toBe(resolve(runsRoot));
    expect(dirname(planned.planPath).split(/[\\/]/).pop()).toMatch(/^insight-reset-\d{8}T\d{9}Z$/);
    expect(RUNS_ROOT.split(/[\\/]/).pop()).toBe('growth-replay-runs');
  });

  it('refuses a run folder inside the repo tree', async () => {
    const { db } = makeDb();
    await expect(planOn(db, { runsRoot: join(HERE, '..', 'docs') })).rejects.toBeInstanceOf(Refusal);
    await expect(planOn(db, { runsRoot: HERE })).rejects.toThrow(/inside the repo tree/);
  });
});

describe('apply: the write', () => {
  it('writes exactly the five listed fields on every agent in the set, one stamp for the run', async () => {
    const { db, writes } = makeDb();
    const result = await planAndApply(db);
    expect(result).toMatchObject({ written: 4, skipped: 0, noop: 0, errors: 0, clean: true });
    expect(writes.map((w) => w.id).sort()).toEqual([...SET_IDS].sort());
    for (const w of writes) {
      expect(w.coll).toBe('agents');
      expect(Object.keys(w.patch).sort()).toEqual([
        'consolidatedInsight', 'consolidatedInsightResetAt', 'consolidatedInsightResetReason', 'disciplines', 'pendingConsolidation',
      ]);
      expect(w.patch.consolidatedInsight).toBe('');
      expect(isDeleteSentinel(w.patch.disciplines)).toBe(true);
      expect(w.patch.pendingConsolidation).toBe(false);
      expect(w.patch.consolidatedInsightResetAt).toBe(SATURDAY.toISOString());
      expect(w.patch.consolidatedInsightResetReason).toBe('failure_built');
    }
    expect(RESET_REASON).toBe('failure_built');
  });

  it('leaves the disciplines field absent, the creation-time value, and every other field as it was', async () => {
    const before = fleet();
    const { db, state } = makeDb();
    await planAndApply(db);
    for (const id of SET_IDS) {
      const { consolidatedInsight, disciplines, pendingConsolidation, ...rest } = before[id];
      expect(state.agents[id]).toEqual({
        ...rest,
        consolidatedInsight: '',
        pendingConsolidation: false,
        consolidatedInsightResetAt: SATURDAY.toISOString(),
        consolidatedInsightResetReason: 'failure_built',
      });
      expect('disciplines' in state.agents[id]).toBe(false);
    }
  });

  it('never touches an agent outside the set', async () => {
    const before = fleet();
    const { db, state } = makeDb();
    await planAndApply(db);
    for (const id of [`${SECRET_ID}-outsider`, `${SECRET_ID}-blank`, `${SECRET_ID}-odd`]) expect(state.agents[id]).toEqual(before[id]);
  });

  it('skips an agent whose paragraph changed since the plan, and writes the rest', async () => {
    const { db, state, writes } = makeDb();
    const planned = await planOn(db);
    state.agents[`${SECRET_ID}-ranked`].consolidatedInsight = 'A real paragraph about a failed reflection, rewritten.';
    const log = vi.fn();
    const result = await applyWith(db, planned, { log });
    expect(result).toMatchObject({ written: 3, skipped: 1, changed: 1, clean: false });
    expect(writes.map((w) => w.id)).not.toContain(`${SECRET_ID}-ranked`);
    expect(state.agents[`${SECRET_ID}-ranked`].disciplines).toEqual(DOSSIER);
    expect(log.mock.calls[0][0]).toContain('written=3 skipped=1 (changed since plan 1, battle started 0) no-op=0 errors=0 not attempted=0');
  });

  it('skips an agent that changed between the backup and its transaction', async () => {
    const { db, state, hooks, writes } = makeDb();
    const planned = await planOn(db);
    hooks.beforeTransaction = (n, s) => { if (n === 0) s.agents[SET_IDS[0]].consolidatedInsight = 'something else'; };
    const result = await applyWith(db, planned);
    expect(result).toMatchObject({ written: 3, changed: 1 });
    expect(writes.map((w) => w.id)).not.toContain(SET_IDS[0]);
    expect(state.agents[SET_IDS[0]].consolidatedInsight).toBe('something else');
  });

  it('skips an agent whose pendingConsolidation moved after the backup, so restore never writes a stale value', async () => {
    const { db, hooks, writes } = makeDb();
    const planned = await planOn(db);
    hooks.beforeTransaction = (n, s) => { if (n === 1) s.agents[SET_IDS[1]].pendingConsolidation = true; };
    const result = await applyWith(db, planned);
    expect(result).toMatchObject({ written: 3, changed: 1 });
    expect(writes.map((w) => w.id)).not.toContain(SET_IDS[1]);
  });

  it('skips an agent whose disciplines moved after the backup', async () => {
    const { db, hooks, writes } = makeDb();
    const planned = await planOn(db);
    hooks.beforeTransaction = (n, s) => { if (n === 0) s.agents[SET_IDS[0]].disciplines = { selection: [], execution: [] }; };
    await applyWith(db, planned);
    expect(writes.map((w) => w.id)).not.toContain(SET_IDS[0]);
  });

  it('skips an agent deleted since the plan', async () => {
    const { db, state, writes } = makeDb();
    const planned = await planOn(db);
    delete state.agents[SET_IDS[0]];
    const result = await applyWith(db, planned);
    expect(result).toMatchObject({ written: 3, changed: 1 });
    expect(writes.map((w) => w.id)).not.toContain(SET_IDS[0]);
    expect(backupOf(result).agents.find((r) => r.id === SET_IDS[0])).toEqual({ id: SET_IDS[0], exists: false, fields: {} });
  });

  it('a forged plan entry naming an agent outside the rule, with its true hash, is never written', async () => {
    const { db, state, writes } = makeDb();
    const paragraph = state.agents[`${SECRET_ID}-outsider`].consolidatedInsight;
    const forged = join(runsRoot, 'forged.local.json');
    const body = JSON.stringify({
      schema: 'insight-reset-plan-v1',
      entries: [{ id: `${SECRET_ID}-outsider`, isClone: false, insightSha256: hashOf(paragraph) }],
    });
    writeFileSync(forged, body);
    const result = await applyWith(db, { planPath: forged, planSha256: hashOf(body) });
    expect(result).toMatchObject({ written: 0, changed: 1 });
    expect(writes).toEqual([]);
  });

  it('re-running on reset agents is a no-op, in a fresh folder, and the first backup survives', async () => {
    const { db, writes } = makeDb();
    const planned = await planOn(db);
    const first = await applyWith(db, planned);
    const firstBackup = readFileSync(first.backupPath, 'utf8');
    const log = vi.fn();
    const second = await applyWith(db, planned, { now: SUNDAY, log });
    expect(second).toMatchObject({ written: 0, skipped: 0, noop: 4, errors: 0, clean: true });
    expect(writes).toHaveLength(4);
    expect(second.backupPath).not.toBe(first.backupPath);
    expect(readFileSync(first.backupPath, 'utf8')).toBe(firstBackup);
    expect(log.mock.calls[0][0]).toContain('written=0 skipped=0 (changed since plan 0, battle started 0) no-op=4');
  });

  it('a blanked paragraph without the reset stamp is not a no-op', async () => {
    const { db, state } = makeDb();
    const planned = await planOn(db);
    state.agents[SET_IDS[0]].consolidatedInsight = '';
    expect(await applyWith(db, planned)).toMatchObject({ written: 3, noop: 0, changed: 1 });
  });

  it('isAlreadyReset needs all three: empty, a stamp and the reason', () => {
    expect(isAlreadyReset({ consolidatedInsight: '', consolidatedInsightResetAt: 't', consolidatedInsightResetReason: 'failure_built' })).toBe(true);
    expect(isAlreadyReset({ consolidatedInsight: 'x', consolidatedInsightResetAt: 't', consolidatedInsightResetReason: 'failure_built' })).toBe(false);
    expect(isAlreadyReset({ consolidatedInsight: '', consolidatedInsightResetReason: 'failure_built' })).toBe(false);
    expect(isAlreadyReset({ consolidatedInsight: '', consolidatedInsightResetAt: 't', consolidatedInsightResetReason: 'other' })).toBe(false);
  });

  it('counts a transaction error, carries on with the rest, and is not a clean run', async () => {
    const { db, hooks, writes } = makeDb();
    const planned = await planOn(db);
    hooks.beforeTransaction = (n) => { if (n === 1) throw new Error('boom'); };
    const result = await applyWith(db, planned);
    expect(result).toMatchObject({ written: 3, errors: 1, clean: false });
    expect(writes).toHaveLength(3);
  });
});

describe('apply: the refusals (each before any write and before any backup)', () => {
  const noRunFolderBesides = (planned) => readdirSync(runsRoot).filter((d) => d !== dirname(planned.planPath).split(/[\\/]/).pop());

  it('refuses without --go', async () => {
    const { db, writes } = makeDb();
    const planned = await planOn(db);
    await expect(applyWith(db, planned, { go: false })).rejects.toThrow(/--go/);
    await expect(applyWith(db, planned, { go: undefined })).rejects.toThrow(/--go/);
    expect(writes).toEqual([]);
  });

  it('refuses a plan file edited after the hash was printed', async () => {
    const { db, writes, transactionCount } = makeDb();
    const planned = await planOn(db);
    const edited = readFileSync(planned.planPath, 'utf8').replace('"isClone": false', '"isClone": true');
    writeFileSync(planned.planPath, edited);
    await expect(applyWith(db, planned)).rejects.toThrow(/does not match --plan-sha256/);
    expect(writes).toEqual([]);
    expect(transactionCount()).toBe(0);
    expect(noRunFolderBesides(planned)).toEqual([]);
  });

  it('refuses a hash that is not the plan file\'s, and one that is not a hash at all', async () => {
    const { db, writes } = makeDb();
    const planned = await planOn(db);
    await expect(applyWith(db, planned, { planSha256: 'a'.repeat(64) })).rejects.toThrow(/does not match/);
    await expect(applyWith(db, planned, { planSha256: 'abc' })).rejects.toThrow(/64-character/);
    await expect(applyWith(db, planned, { planSha256: null })).rejects.toThrow(/64-character/);
    expect(writes).toEqual([]);
  });

  it('refuses a plan that is unreadable, empty, or malformed', async () => {
    const { db, writes } = makeDb();
    const write = (name, value) => {
      const planPath = join(runsRoot, name);
      const body = JSON.stringify(value);
      writeFileSync(planPath, body);
      return { planPath, planSha256: hashOf(body) };
    };
    const schema = 'insight-reset-plan-v1';
    const hash = 'a'.repeat(64);
    await expect(applyWith(db, { planPath: join(runsRoot, 'nope.json'), planSha256: hash })).rejects.toThrow(/cannot be read/);
    await expect(applyWith(db, write('e.json', { schema, entries: [] }))).rejects.toThrow(/no agents/);
    await expect(applyWith(db, write('s.json', { schema: 'other', entries: [{ id: 'a', insightSha256: hash }] }))).rejects.toThrow(/no agents/);
    await expect(applyWith(db, write('p.json', { schema, entries: [{ id: 'a/b', insightSha256: hash }] }))).rejects.toThrow(/malformed/);
    await expect(applyWith(db, write('h.json', { schema, entries: [{ id: 'a', insightSha256: 'short' }] }))).rejects.toThrow(/malformed/);
    await expect(applyWith(db, write('d.json', { schema, entries: [{ id: 'a', insightSha256: hash }, { id: 'a', insightSha256: hash }] }))).rejects.toThrow(/repeated/);
    expect(writes).toEqual([]);
  });

  it('refuses on a weekday without the flag, and runs with it', async () => {
    const { db, writes } = makeDb();
    const planned = await planOn(db);
    await expect(applyWith(db, planned, { now: MONDAY })).rejects.toThrow(/weekday/);
    expect(writes).toEqual([]);
    expect(await applyWith(db, planned, { now: MONDAY, allowWeekday: true })).toMatchObject({ written: 4 });
  });

  it('runs on a Sunday without the flag', async () => {
    const { db } = makeDb();
    expect(await planAndApply(db, { now: SUNDAY })).toMatchObject({ written: 4 });
  });

  const refusesFor = async (setup) => {
    const { db, state, writes, transactionCount } = makeDb();
    const planned = await planOn(db);
    setup(state);
    await expect(applyWith(db, planned)).rejects.toThrow(/a battle is live/);
    expect(writes).toEqual([]);
    expect(transactionCount()).toBe(0);
    expect(noRunFolderBesides(planned)).toEqual([]);
  };
  const activeBattle = (agentId) => ({ agentId, status: 'active' });

  it('refuses on an active battle on the agent, by the battle record', () => refusesFor((s) => {
    s.agentBattles.b = activeBattle(`${SECRET_ID}-serialised`);
  }));

  it('refuses on an active battle on the agent, by its activeBattleId', () => refusesFor((s) => {
    s.agents[`${SECRET_ID}-serialised`].activeBattleId = 'b1';
  }));

  it('refuses on an active battle on its ranked parent, record and pointer', async () => {
    const paragraph = 'a reflection failed';
    const agents = {
      parent: { consolidatedInsight: 'Patience pays.', activeBattleId: null },
      clone: { isTrainingClone: true, rankedAgentId: 'parent', consolidatedInsight: paragraph },
    };
    const byRecord = makeDb({ agents, battles: [activeBattle('parent')] });
    await expect(planAndApply(byRecord.db)).rejects.toThrow(/ranked parent 1/);
    const byPointer = makeDb({ agents: { ...agents, parent: { ...agents.parent, activeBattleId: 'b1' } } });
    await expect(planAndApply(byPointer.db)).rejects.toThrow(/ranked parent 1/);
    expect(byRecord.writes).toEqual([]);
    expect(byPointer.writes).toEqual([]);
  });

  it('refuses on an active battle on a clone, record and pointer, even a clone outside the plan', async () => {
    const agents = {
      parent: { consolidatedInsight: 'a reflection failed', activeBattleId: null },
      clone: { isCasualClone: true, rankedAgentId: 'parent', consolidatedInsight: '' },
    };
    const byRecord = makeDb({ agents, battles: [activeBattle('clone')] });
    await expect(planAndApply(byRecord.db)).rejects.toThrow(/clone 1/);
    const byPointer = makeDb({ agents: { ...agents, clone: { ...agents.clone, activeBattleId: 'b1' } } });
    await expect(planAndApply(byPointer.db)).rejects.toThrow(/clone 1/);
    expect(byRecord.writes).toEqual([]);
    expect(byPointer.writes).toEqual([]);
  });

  it('takes any id that names one document, so plan and apply agree on who can be written', async () => {
    const { db, writes } = makeDb({ agents: { 'clone:pod.1~x': { consolidatedInsight: 'a reflection failed' } } });
    expect(await planAndApply(db)).toMatchObject({ written: 1 });
    expect(writes.map((w) => w.id)).toEqual(['clone:pod.1~x']);
  });

  it('a finished battle does not hold the run', async () => {
    const { db } = makeDb({ battles: [{ agentId: SET_IDS[0], status: 'completed' }] });
    expect(await planAndApply(db)).toMatchObject({ written: 4 });
  });

  it('a deploy inside decide.js\'s two-minute lock holds the run, and a stale lock does not', () => {
    const nowMs = SATURDAY.getTime();
    const agent = (deployingAt) => [{ id: 'a', deployingAt }];
    expect(countBattleHolds(['a'], agent(new Date(nowMs - 119_000).toISOString()), new Set(), nowMs).own).toBe(1);
    expect(countBattleHolds(['a'], agent(new Date(nowMs - 120_000).toISOString()), new Set(), nowMs).own).toBe(0);
    expect(countBattleHolds(['a'], agent(null), new Set(), nowMs).own).toBe(0);
    expect(countBattleHolds(['a'], agent(undefined), new Set(), nowMs).own).toBe(0);
  });

  it('refuses on a deploy inside its lock, read through the fleet the run really reads', () => refusesFor((s) => {
    s.agents[`${SECRET_ID}-serialised`].deployingAt = new Date(SATURDAY.getTime() - 30_000).toISOString();
  }));

  it('countBattleHolds counts each agent once in `blocked`, and each relation on its own', () => {
    const rows = [
      { id: 'parent', activeBattleId: 'p' },
      { id: 'clone', rankedAgentId: 'parent', activeBattleId: 'c' },
      { id: 'other' },
    ];
    expect(countBattleHolds(['parent', 'clone', 'other', 'missing'], rows, new Set(), SATURDAY.getTime()))
      .toEqual({ own: 2, parent: 1, clone: 1, blocked: 2 });
  });

  it('refuses when the write epoch is closed, before the backup', async () => {
    const { db, writes } = makeDb();
    const planned = await planOn(db);
    const closed = async () => { throw Object.assign(new Error('epoch_closed'), { name: 'EpochClosedError' }); };
    await expect(applyWith(db, planned, { assertEpochOpen: closed })).rejects.toThrow('epoch_closed');
    expect(writes).toEqual([]);
    expect(noRunFolderBesides(planned)).toEqual([]);
  });
});

describe('apply: a battle that starts after the guard', () => {
  it('skips the agent whose activeBattleId appeared, and says so', async () => {
    const { db, hooks, writes } = makeDb();
    const planned = await planOn(db);
    hooks.beforeTransaction = (n, s) => { if (n === 0) s.agents[SET_IDS[0]].activeBattleId = 'b1'; };
    const result = await applyWith(db, planned);
    expect(result).toMatchObject({ written: 3, battle: 1, changed: 0, clean: false });
    expect(writes.map((w) => w.id)).not.toContain(SET_IDS[0]);
  });

  it('skips the agent whose active battle record appeared', async () => {
    const { db, hooks, writes } = makeDb();
    const planned = await planOn(db);
    hooks.beforeTransaction = (n, s) => { if (n === 0) s.agentBattles.b = { agentId: SET_IDS[0], status: 'active' }; };
    const result = await applyWith(db, planned);
    expect(result).toMatchObject({ written: 3, battle: 1, clean: false });
    expect(writes.map((w) => w.id)).not.toContain(SET_IDS[0]);
  });

  it('skips the agent whose deploy lock appeared', async () => {
    const { db, hooks, writes } = makeDb();
    const planned = await planOn(db);
    hooks.beforeTransaction = (n, s) => { if (n === 0) s.agents[SET_IDS[0]].deployingAt = SATURDAY.toISOString(); };
    expect(await applyWith(db, planned)).toMatchObject({ written: 3, battle: 1 });
    expect(writes.map((w) => w.id)).not.toContain(SET_IDS[0]);
  });
});

describe('apply: the backup', () => {
  it('is on disk, complete, before the first write', async () => {
    const { db, hooks } = makeDb();
    const planned = await planOn(db);
    let seen = null;
    hooks.onUpdate = () => {
      if (seen) return;
      const folders = readdirSync(runsRoot).filter((d) => existsSync(join(runsRoot, d, 'backup.local.json')));
      expect(folders).toHaveLength(1);
      seen = JSON.parse(readFileSync(join(runsRoot, folders[0], 'backup.local.json'), 'utf8'));
    };
    await applyWith(db, planned);
    expect(seen.agents.map((r) => r.id).sort()).toEqual([...SET_IDS].sort());
    expect(seen.runStamp).toBe(SATURDAY.toISOString());
    expect(seen.planSha256).toBe(planned.planSha256);
  });

  it('holds every field about to change, and leaves out a field the agent never had', async () => {
    const { db } = makeDb();
    const result = await planAndApply(db);
    const rows = Object.fromEntries(backupOf(result).agents.map((r) => [r.id, r]));
    expect(rows[`${SECRET_ID}-ranked`]).toEqual({
      id: `${SECRET_ID}-ranked`, exists: true,
      fields: { consolidatedInsight: FAILED_TEXT, disciplines: DOSSIER, pendingConsolidation: true },
    });
    expect(rows[`${SECRET_ID}-serialised`].fields).toEqual({ consolidatedInsight: SERIALISED_EMPTY });
  });

  it('holds earlier reset stamps too, since the write replaces them', async () => {
    const agents = { a: { consolidatedInsight: 'a reflection failed', consolidatedInsightResetAt: 'old', consolidatedInsightResetReason: 'other' } };
    const { db } = makeDb({ agents });
    const result = await planAndApply(db);
    expect(backupOf(result).agents[0].fields).toMatchObject({ consolidatedInsightResetAt: 'old', consolidatedInsightResetReason: 'other' });
  });

  it('a backup that cannot be written stops the run before any write', async () => {
    const { db, writes } = makeDb();
    const planned = await planOn(db);
    const blocked = join(runsRoot, 'a-file');
    writeFileSync(blocked, 'x');
    await expect(applyWith(db, planned, { runsRoot: blocked })).rejects.toThrow();
    expect(writes).toEqual([]);
  });

  it('a backup that reads back differently stops the run before any write', async () => {
    const { db, writes } = makeDb();
    const planned = await planOn(db);
    tornBackup.on = true;
    try {
      await expect(applyWith(db, planned)).rejects.toThrow(/read back differently/);
    } finally {
      tornBackup.on = false;
    }
    expect(writes).toEqual([]);
  });

  it('forces the bytes to disk before it reads them back', () => {
    expect(SOURCE).toMatch(/writeFileSync\(fd, body\);\s+fsyncSync\(fd\);/);
  });

  it('two runs in the same instant never share a folder', async () => {
    const { db, writes } = makeDb();
    const planned = await planOn(db);
    await applyWith(db, planned, { now: SUNDAY });
    const writtenBefore = writes.length;
    await expect(applyWith(db, planned, { now: SUNDAY })).rejects.toThrow(/EEXIST/);
    expect(writes).toHaveLength(writtenBefore);
  });
});

describe('the write epoch', () => {
  const closesAfter = (calls) => {
    let n = 0;
    return async () => { n += 1; if (n > calls) throw new Error('epoch_closed'); };
  };

  it('apply checks at entry and before every agent, and a close stops it at the next boundary', async () => {
    const { db, writes } = makeDb();
    const planned = await planOn(db);
    const result = await applyWith(db, planned, { assertEpochOpen: closesAfter(3) });
    expect(writes).toHaveLength(2);
    expect(result).toMatchObject({ written: 2, notAttempted: 2, clean: false });
  });

  it('restore checks the same way', async () => {
    const { db, writes } = makeDb();
    const result = await planAndApply(db);
    const before = writes.length;
    await expect(runRestore({ db, backupPath: result.backupPath, go: true, assertEpochOpen: closesAfter(0), log: quiet })).rejects.toThrow('epoch_closed');
    expect(writes).toHaveLength(before);
    const stopped = await runRestore({ db, backupPath: result.backupPath, go: true, assertEpochOpen: closesAfter(2), log: quiet });
    expect(stopped).toMatchObject({ restored: 1, notAttempted: 3, clean: false });
  });
});

describe('restore', () => {
  const restoreFrom = (db, result, over = {}) => runRestore({
    db, backupPath: result.backupPath, go: true, assertEpochOpen: noFence, log: quiet, ...over,
  });

  it('round-trips every agent to its exact state before the reset', async () => {
    const before = fleet();
    const { db, state } = makeDb();
    const result = await planAndApply(db);
    expect(state.agents[SET_IDS[0]]).not.toEqual(before[SET_IDS[0]]);
    expect(await restoreFrom(db, result)).toMatchObject({ restored: 4, skipped: 0, errors: 0, clean: true });
    expect(state.agents).toEqual(before);
  });

  it('removes a field the agent never had, and both stamps', async () => {
    const { db, state, writes } = makeDb();
    const result = await planAndApply(db);
    await restoreFrom(db, result);
    const id = `${SECRET_ID}-serialised`;
    expect('disciplines' in state.agents[id]).toBe(false);
    expect('pendingConsolidation' in state.agents[id]).toBe(false);
    expect('consolidatedInsightResetAt' in state.agents[id]).toBe(false);
    expect('consolidatedInsightResetReason' in state.agents[id]).toBe(false);
    const patch = writes.filter((w) => w.id === id).at(-1).patch;
    expect(Object.keys(patch).sort()).toEqual([
      'consolidatedInsight', 'consolidatedInsightResetAt', 'consolidatedInsightResetReason', 'disciplines', 'pendingConsolidation',
    ]);
  });

  it('skips an agent whose paragraph is no longer empty, and reports it', async () => {
    const { db, state } = makeDb();
    const result = await planAndApply(db);
    state.agents[SET_IDS[0]].consolidatedInsight = 'A new real paragraph.';
    const log = vi.fn();
    expect(await restoreFrom(db, result, { log })).toMatchObject({ restored: 3, skipped: 1, clean: false });
    expect(state.agents[SET_IDS[0]].consolidatedInsight).toBe('A new real paragraph.');
    expect(log.mock.calls[0][0]).toContain('restored=3 skipped=1');
  });

  it('skips an agent whose stamp is not this backup\'s run', async () => {
    const { db, state } = makeDb();
    const result = await planAndApply(db);
    state.agents[SET_IDS[0]].consolidatedInsightResetAt = '2026-11-07T00:00:00.000Z';
    expect(await restoreFrom(db, result)).toMatchObject({ restored: 3, skipped: 1 });
    expect(state.agents[SET_IDS[0]].consolidatedInsight).toBe('');
  });

  it('a second run\'s backup restores nothing the first run wrote', async () => {
    const { db, state } = makeDb();
    const planned = await planOn(db);
    await applyWith(db, planned);
    const second = await applyWith(db, planned, { now: SUNDAY });
    expect(await restoreFrom(db, second)).toMatchObject({ restored: 0, skipped: 4 });
    expect(state.agents[SET_IDS[0]].consolidatedInsight).toBe('');
  });

  it('skips an agent deleted since the reset', async () => {
    const { db, state } = makeDb();
    const result = await planAndApply(db);
    delete state.agents[SET_IDS[0]];
    expect(await restoreFrom(db, result)).toMatchObject({ restored: 3, skipped: 1 });
  });

  it('refuses without --go, and on a file that is not a backup', async () => {
    const { db, writes } = makeDb();
    const result = await planAndApply(db);
    const before = writes.length;
    await expect(restoreFrom(db, result, { go: false })).rejects.toThrow(/--go/);
    const notBackup = join(runsRoot, 'x.json');
    writeFileSync(notBackup, JSON.stringify({ schema: 'other', runStamp: 'x', agents: [] }));
    await expect(restoreFrom(db, { backupPath: notBackup })).rejects.toThrow(/not a backup/);
    await expect(restoreFrom(db, { backupPath: join(runsRoot, 'gone.json') })).rejects.toThrow(/cannot be read/);
    const good = { schema: 'insight-reset-backup-v1', runStamp: SATURDAY.toISOString(), agents: [{ id: 'a', exists: true, fields: {} }] };
    const writeBackupFile = (value) => {
      const backupPath = join(runsRoot, 'y.json');
      writeFileSync(backupPath, JSON.stringify(value));
      return { backupPath };
    };
    await expect(restoreFrom(db, writeBackupFile({ ...good, runStamp: 'yesterday' }))).rejects.toThrow(/not a backup/);
    await expect(restoreFrom(db, writeBackupFile({ ...good, runStamp: 7 }))).rejects.toThrow(/not a backup/);
    await expect(restoreFrom(db, writeBackupFile({ ...good, agents: 'none' }))).rejects.toThrow(/not a backup/);
    await expect(restoreFrom(db, writeBackupFile({ ...good, agents: [{ id: 'a/b', fields: {} }] }))).rejects.toThrow(/not a backup/);
    await expect(restoreFrom(db, writeBackupFile({ ...good, agents: [{ id: 'a' }] }))).rejects.toThrow(/not a backup/);
    expect(writes).toHaveLength(before);
  });

  it('counts a transaction error and is not a clean run', async () => {
    const { db, hooks } = makeDb();
    const result = await planAndApply(db);
    hooks.beforeTransaction = (n) => { if (n === 4) throw new Error('boom'); };
    expect(await restoreFrom(db, result)).toMatchObject({ restored: 3, errors: 1, clean: false });
  });
});

describe('nothing printed carries an id or an agent\'s words', () => {
  const printed = () => [console.log, console.error, console.warn, console.info]
    .flatMap((fn) => fn.mock.calls.flat().map(String)).join('\n');
  const expectClean = (text) => {
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain('SECRETID');
    expect(text).not.toContain(SECRET_TEXT);
    expect(text).not.toContain('disc_1');
    expect(text).not.toContain('reflections failed');
  };

  beforeEach(() => { for (const m of ['log', 'error', 'warn', 'info']) vi.spyOn(console, m).mockImplementation(() => {}); });

  it('across census, plan, apply and restore, on the default printer', async () => {
    const { db } = makeDb();
    await runCensus({ db, now: SATURDAY });
    const planned = await runPlan({ db, now: PLAN_TIME, runsRoot });
    const result = await runApply({ db, planPath: planned.planPath, planSha256: planned.planSha256, go: true, assertEpochOpen: noFence, now: SATURDAY, runsRoot });
    await runRestore({ db, backupPath: result.backupPath, go: true, assertEpochOpen: noFence });
    expectClean(printed());
  });

  it('when a transaction throws with an id and the paragraph in its message', async () => {
    const { db, hooks } = makeDb();
    const planned = await runPlan({ db, now: PLAN_TIME, runsRoot });
    hooks.beforeTransaction = () => { throw new Error(`No document at agents/${SET_IDS[0]}: ${FAILED_TEXT}`); };
    const result = await runApply({ db, planPath: planned.planPath, planSha256: planned.planSha256, go: true, assertEpochOpen: noFence, now: SATURDAY, runsRoot });
    expect(result.errors).toBe(4);
    expect(printed()).toContain('error class Error: 4');
    hooks.beforeTransaction = null;
    const restored = await runRestore({ db, backupPath: result.backupPath, go: true, assertEpochOpen: noFence });
    expect(restored.skipped).toBe(4);
    hooks.beforeTransaction = () => { throw new Error(`agents/${SET_IDS[0]}: ${FAILED_TEXT}`); };
    await runRestore({ db, backupPath: result.backupPath, go: true, assertEpochOpen: noFence });
    expectClean(printed());
  });

  it('when the failure line of a thrown error is printed', () => {
    const planted = new Error(`agents/${SET_IDS[0]}: ${FAILED_TEXT}`);
    const line = failureLine(planted);
    expect(line).toBe('FAILED: Error');
    expect(failureLine(Object.assign(new Error('x'), { name: `Bad ${SECRET_TEXT} name!`, code: `agents/${SET_IDS[0]}` }))).toBe('FAILED: Error');
    expect(failureLine(Object.assign(new Error(planted.message), { code: 5 }))).toBe('FAILED: Error 5');
    expect(failureLine(new Refusal('the plan file holds no agents to reset'))).toBe('REFUSED: the plan file holds no agents to reset');
  });

  it('prints only through console, so the rows above see everything', () => {
    expect(SOURCE).not.toMatch(/process\.std(out|err)/);
  });
});

describe('the command line', () => {
  it('reads each subcommand', () => {
    expect(parseArgs(['census'])).toMatchObject({ command: 'census', go: false });
    expect(parseArgs(['plan'])).toMatchObject({ command: 'plan' });
    expect(parseArgs(['apply', '--plan', 'p.json', '--plan-sha256', 'abc', '--go', '--allow-weekday']))
      .toMatchObject({ command: 'apply', planPath: 'p.json', planSha256: 'abc', go: true, allowWeekday: true });
    expect(parseArgs(['apply', '--plan', 'p.json', '--plan-sha256', 'abc'])).toMatchObject({ go: false, allowWeekday: false });
    expect(parseArgs(['restore', '--backup', 'b.json', '--go'])).toMatchObject({ command: 'restore', backupPath: 'b.json', go: true });
  });

  it('refuses a typo, a missing value and a missing required flag rather than guessing', () => {
    for (const argv of [
      [], ['nope'], ['constructor'],
      ['census', '--go'],
      ['apply', '--plan', 'p', '--plan-sha256', 'a', '--go', '--allow-weekdays'],
      ['apply', '--plan', '--go'],
      ['apply', '--plan', 'p', '--go'],
      ['apply', '--plan-sha256', 'a', '--go'],
      ['restore', '--go'],
      ['restore', '--backup', 'b', '--plan', 'p'],
      ['restore', '--backup'],
    ]) expect(() => parseArgs(argv), argv.join(' ')).toThrow(Refusal);
  });
});

describe('writes only where they are meant to be (the growth replay §7 discipline)', () => {
  const AST = parse(SOURCE, { ecmaVersion: 'latest', sourceType: 'module' });
  const WRITE_GREP = /\.(set|update|delete|add|create)\s*\(|runTransaction|\.batch\(|bulkWriter|writeBatch|FieldValue|recursiveDelete/;
  const namedFunctions = AST.body.flatMap((n) => {
    const fn = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
    return fn?.type === 'FunctionDeclaration' ? [{ name: fn.id.name, start: fn.start, end: fn.end }] : [];
  });
  const enclosing = (pos) => namedFunctions.find((f) => pos >= f.start && pos < f.end)?.name ?? '<module>';

  it('the grep finds exactly these lines: the two writes and the one import', () => {
    let pos = 0;
    const hits = [];
    for (const line of SOURCE.split('\n')) {
      if (WRITE_GREP.test(line)) hits.push([enclosing(pos), line.trim()]);
      pos += line.length + 1;
    }
    expect(hits).toEqual([
      ['<module>', "import { FieldValue } from 'firebase-admin/firestore';"],
      ['resetOneAgent', 'return db.runTransaction(async (tx) => {'],
      ['resetOneAgent', 'tx.update(ref, {'],
      ['resetOneAgent', 'disciplines: FieldValue.delete(),'],
      ['restoreOneAgent', 'return db.runTransaction(async (tx) => {'],
      ['restoreOneAgent', 'consolidatedInsightResetAt: FieldValue.delete(),'],
      ['restoreOneAgent', 'consolidatedInsightResetReason: FieldValue.delete(),'],
      ['restoreOneAgent', 'for (const f of RESTORED_FIELDS) patch[f] = Object.hasOwn(row.fields, f) ? row.fields[f] : FieldValue.delete();'],
      ['restoreOneAgent', 'tx.update(ref, patch);'],
    ]);
  });

  it('only apply reaches resetOneAgent and only restore reaches restoreOneAgent', () => {
    const callers = (callee) => {
      const out = [];
      const walk = (n) => {
        if (!n || typeof n.type !== 'string') return;
        if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === callee) out.push(enclosing(n.start));
        for (const k of Object.keys(n)) {
          const v = n[k];
          if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v);
        }
      };
      walk(AST);
      return out;
    };
    expect(callers('resetOneAgent')).toEqual(['runApply']);
    expect(callers('restoreOneAgent')).toEqual(['runRestore']);
  });

  it('credentials load only inside main(): the top-level imports hold none, and the dynamic ones sit in main', () => {
    const staticImports = AST.body.filter((n) => n.type === 'ImportDeclaration').map((n) => n.source.value);
    expect(staticImports).toEqual([
      'node:process', 'node:crypto', 'node:fs', 'node:os', 'node:path', 'node:url', 'node:util', 'firebase-admin/firestore',
    ]);
    const dynamic = [];
    const walk = (n) => {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'ImportExpression') dynamic.push([enclosing(n.start), n.source.value]);
      for (const k of Object.keys(n)) {
        const v = n[k];
        if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v);
      }
    };
    walk(AST);
    expect(dynamic).toEqual([
      ['main', './loadLocalEnv.js'],
      ['main', '../api/_utils/firebaseAdmin.js'],
      ['main', '../api/_utils/compositionWriteEpoch.js'],
    ]);
  });

  it('the real fence is what main passes in', () => {
    expect(SOURCE).toContain('const assertEpochOpen = (firestore) => assertWriteEpochOpen(firestore);');
  });
});
