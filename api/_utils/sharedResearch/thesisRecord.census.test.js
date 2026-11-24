// api/_utils/sharedResearch/thesisRecord.census.test.js
//
// Shared Research B3 — THE SAVED THESIS, as the Practice Field reads it (Amendment
// B §B10, the Practice Field's PF-1 and PF-2).
//
// PF-1 · `thesisCard` has ONE writer: the field's name lives in one constant
// (thesis.js THESIS_CARD_FIELD), the constant reaches one module (store.js), and
// that module names it once — in adoptThesis's list fields, inside the save
// transaction. No other module names the field, and the list's own edit route
// builds its update from named fields only (and refuses a committed list).
//
// PF-2 · Every finding id the card carries resolves on the research record for as
// long as the list exists, because NOTHING deletes or prunes a research record or
// its findings: the rules refuse every client write to `researchWork`; no module
// that names the collection makes a delete call; the record model's patches never
// rewrite `findings` except findingAppendPatch, which keeps every earlier finding
// and adds one. So the ids suffice and the card carries no copy of the findings.
//
// The threat model, said on purpose: a static reading of the tree as it stands. A
// module that reached the collection by a name built at run time, or a script run
// by hand outside the repo, is outside it (the Film Room census's ruling Q-11).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { stripComments, callNamesOf } from '../filmRoom/__fixtures__/jsSource.js';
import { THESIS_CARD_FIELD } from './thesis.js';
import {
  buildRecord, findingAppendPatch, closePatch, turnPatch, summaryRevisionPatch, questionPatch, manualFunnel, emptyTelemetry, researchWorkIdFor,
} from '../researchRecords/model.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const rel = (abs) => path.relative(REPO, abs).split(path.sep).join('/');
const read = (r) => readFileSync(path.join(REPO, r), 'utf8');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.vite', '__fixtures__', '__mocks__', '__golden__']);
function sources(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) { if (!SKIP_DIRS.has(name)) out.push(...sources(abs)); continue; }
    if (!/\.(?:js|jsx|mjs|cjs)$/.test(name) || /\.test\.|\.spec\./.test(name)) continue;
    out.push(rel(abs));
  }
  return out;
}
const ALL = ['api', 'src', 'scripts'].flatMap((d) => sources(path.join(REPO, d)));
/**
 * The files that are no module: the composition ledger's cell fragments, object-literal text that
 * scripts/composition/assemble.mjs reads with readFileSync and wraps itself. Any OTHER file the parser cannot read
 * fails the census (a census that cannot read a file never passes it).
 */
const FRAGMENTS = /^scripts\/composition\/cells_C\d+\.js$/;
const TREE = ALL.filter((r) => !FRAGMENTS.test(r));
const codeCache = new Map();
const codeOf = (r) => { if (!codeCache.has(r)) codeCache.set(r, stripComments(read(r), r)); return codeCache.get(r); };

describe('PF-1 — thesisCard has one writer, the save transaction', () => {
  it('the walk reads the tree (a census that reads nothing passes nothing); only the named fragments are left out', () => {
    expect(TREE.length).toBeGreaterThan(1000);
    expect(TREE).toContain('api/_utils/sharedResearch/store.js');
    const left = ALL.filter((r) => FRAGMENTS.test(r));
    expect(left.length).toBeGreaterThan(0);
    for (const r of left) expect(read('scripts/composition/assemble.mjs')).toContain('cells_${label}.js');
  });
  it('the field\'s name is written in code in exactly two modules: the constant in thesis.js, and the Practice Field\'s one reader', { timeout: 60_000 }, () => {
    expect(THESIS_CARD_FIELD).toBe('thesisCard');
    const naming = TREE.filter((r) => /\bthesisCard\b/.test(codeOf(r)));
    // Practice Field build B2 (ruling PF-5): the idea book's drafting READS the saved card — W-9 named the Practice Field as
    // a reader of this name and shape. Its one module names the field once, in a constant, and writes nothing (next row).
    expect(naming).toEqual(['api/_utils/practiceField/agentSources.js', 'api/_utils/sharedResearch/thesis.js']);
    expect(codeOf('api/_utils/sharedResearch/thesis.js').match(/'thesisCard'/g)).toHaveLength(1);
    expect(codeOf('api/_utils/practiceField/agentSources.js').match(/\bthesisCard\b/g)).toHaveLength(1);
  });
  it('the Practice Field\'s reader WRITES NOTHING: no set, update, create, delete or transaction anywhere in its module', () => {
    const calls = callNamesOf(read('api/_utils/practiceField/agentSources.js'), 'api/_utils/practiceField/agentSources.js').map((c) => c.name);
    expect(calls.length).toBeGreaterThan(5); // the walk read the module (a census that reads nothing passes nothing)
    expect(calls).toContain('get');
    // (Not `add`: the module's Set.add calls share the name; it makes no collection write of any kind.)
    expect(calls.filter((n) => /^(?:set|update|create|delete|recursiveDelete|arrayRemove|runTransaction|batch|commit)$/.test(n))).toEqual([]);
  });
  it('the constant reaches one module, and that module names it once: in adoptThesis, inside the save', { timeout: 60_000 }, () => {
    const users = TREE.filter((r) => r !== 'api/_utils/sharedResearch/thesis.js' && /\bTHESIS_CARD_FIELD\b/.test(codeOf(r)));
    expect(users).toEqual(['api/_utils/sharedResearch/store.js']);
    const store = codeOf('api/_utils/sharedResearch/store.js');
    const uses = [...store.matchAll(/\bTHESIS_CARD_FIELD\b/g)].map((m) => m.index);
    expect(uses).toHaveLength(2); // the import, and the one write
    const fnStart = store.indexOf('export async function adoptThesis(');
    const fnEnd = store.indexOf('\nexport ', fnStart + 1);
    expect(uses[1] > fnStart && uses[1] < fnEnd).toBe(true);
    const extra = store.lastIndexOf('listExtra:', uses[1]);
    expect(extra > fnStart && uses[1] - extra < 200).toBe(true); // inside the save's list fields, nowhere else
  });
  it('the list\'s edit route builds its update from named fields only, and refuses a committed list', () => {
    const route = codeOf('api/forge/watchlists/[id].js');
    expect(route).not.toMatch(/\.\.\.\s*(?:req\.)?body\b/);
    expect(route).toMatch(/data\.status === 'committed'/);
  });
});

describe('PF-2 — nothing deletes or prunes a research record or its findings', () => {
  it('the rules: researchWork is owner-read, and no client writes it at all', () => {
    const rules = read('firestore.rules');
    const start = rules.indexOf('match /researchWork/{researchWorkId} {');
    expect(start).toBeGreaterThan(0);
    const block = rules.slice(start, rules.indexOf('\n    }', start));
    expect(block).toMatch(/allow write: if false;/);
    expect(block).not.toMatch(/allow (?:delete|update|create)/);
  });
  it('no module that names the collection makes a delete, a recursive delete or an array removal', { timeout: 60_000 }, () => {
    const naming = TREE.filter((r) => /\bRESEARCH_WORK_COLLECTION\b|\bresearchWorkRefOf\b|['"`]researchWork['"`/]/.test(codeOf(r)));
    expect(naming).toEqual(expect.arrayContaining(['api/_utils/researchRecords/model.js', 'api/_utils/researchRecords/store.js', 'api/_utils/sharedResearch/store.js']));
    const deleting = naming.flatMap((r) => callNamesOf(read(r), r)
      .filter((c) => /^(?:delete|recursiveDelete|arrayRemove)$/.test(c.name))
      .map((c) => `${r}:${c.line}:${c.name}`));
    expect(deleting).toEqual([]);
  });
  it('the record model\'s patches never rewrite `findings` — only findingAppendPatch, which keeps every earlier finding', () => {
    const at = '2026-11-16T15:00:00.000Z';
    const f = (n, extra = {}) => ({
      findingId: `f_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, kind: 'coverage', symbol: null, fact: `fact ${n}`,
      source: { recordKind: 'retrieval', recordId: `https://x.example/${n}`, label: 'x', url: `https://x.example/${n}` },
      at, asOf: null, status: 'verified', statusReason: null, supersedes: null, ...extra,
    });
    let record = buildRecord({
      researchWorkId: researchWorkIdFor({ collection: 'sharedResearchSessions', id: '0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a' }), userId: 'u1', origin: 'shared_research',
      host: { collection: 'sharedResearchSessions', id: '0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a' }, createdAt: at, question: 'q?',
      funnel: manualFunnel(), budget: null, telemetry: emptyTelemetry(),
    });
    for (const n of [1, 2]) record = { ...record, ...findingAppendPatch(record, f(n), { nowIso: at }) };
    const before = record.findings.map((x) => x.findingId);
    const corrected = findingAppendPatch(record, f(3, { supersedes: before[0] }), { nowIso: at });
    expect(corrected.findings.map((x) => x.findingId)).toEqual([...before, f(3).findingId]); // a correction appends; the corrected one stays
    for (const patch of [
      summaryRevisionPatch(record, { text: 'fact 1.', basedOn: [before[0]] }, { nowIso: at }),
      turnPatch(record, { kind: 'completion', elapsedMs: 1, usage: { input: 1, output: 1 }, atIso: at }),
      closePatch(record, { state: 'completed', terminalReason: 'concluded', atIso: at, funnel: manualFunnel() }),
    ]) expect(Object.keys(patch)).not.toContain('findings');
    expect(Object.keys(questionPatch({ ...record, question: undefined }, { question: 'q2?', atIso: at }) ?? {})).not.toContain('findings');
  });
});
