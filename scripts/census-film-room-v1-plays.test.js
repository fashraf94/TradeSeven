// scripts/census-film-room-v1-plays.test.js
//
// Film Room C1 fix round — Build C Amendment A CA-13: the read-only census of the stored plays ledger. Importing the
// module runs nothing and asks for no credential (main() is guarded behind the CLI entrypoint); that passing load is
// the BUILD_RULES §4 dependency-surface guard for the script. The rows pin what CA-13 rules: no write call, no id or
// owner in the output, no filter on the one read, and honest buckets for a missing or unknown field.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  WRITE_PATTERN, GATED_FILE, writeCallsIn, PLAYS_GROUP, SELECTED_FIELDS, ROUTE_BUCKETS, STAGE_BUCKETS, countPlays, renderCensus, readPlays, failureLine,
} from './census-film-room-v1-plays.mjs';
import { CARD_ROUTES, CARD_STAGES } from '../src/data/cardStages.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

/** A fake Admin handle that records every call the read makes, and hands back documents with ids, paths and owners. */
function fakeDb(docs) {
  const calls = [];
  const query = {
    select: (...fields) => { calls.push(['select', ...fields]); return query; },
    where: (...a) => { calls.push(['where', ...a]); return query; },
    orderBy: (...a) => { calls.push(['orderBy', ...a]); return query; },
    limit: (...a) => { calls.push(['limit', ...a]); return query; },
    startAfter: (...a) => { calls.push(['startAfter', ...a]); return query; },
    get: async () => { calls.push(['get']); return { docs: docs.map(({ id, data }) => ({ id, ref: { path: `agents/agent-${id}/plays/${id}` }, data: () => data })) }; },
  };
  return { calls, db: { collectionGroup: (name) => { calls.push(['collectionGroup', name]); return query; }, collection: () => { throw new Error('no collection read'); } } };
}

/** Production-shaped documents, every field a card holds (the selection would strip them; the fake does not, so the census must). */
const DOCS = [
  { id: 'op_d1', data: { route: 'drill', stage: 'nominated', ownerId: 'owner-XYZ123abc', agentId: 'agent-Q9r8s7', note: 'secret note text', entryId: 'op_d1' } },
  { id: 'op_d2', data: { route: 'drill', stage: 'retired', ownerId: 'owner-XYZ123abc' } },
  { id: 'op_w1', data: { route: 'watch', stage: 'card', ownerId: 'owner-ABC987xyz' } },
  { id: 'op_o1', data: { route: 'offer', stage: 'nominated', ownerId: 'owner-ABC987xyz' } },
  { id: 'op_s1', data: { route: 'set', stage: 'tested', ownerId: 'owner-ABC987xyz' } },
  { id: 'op_m1', data: { stage: 'card', ownerId: 'owner-M1ss1ng' } },                              // route missing
  { id: 'op_m2', data: { route: null, stage: null } },                                           // both null → missing
  { id: 'op_u1', data: { route: 'practice', stage: 'drilled', ownerId: 'owner-UNK0wn42' } },        // unknown words
  { id: 'op_u2', data: { route: 'owner-LEAK777id', stage: 42 } },                                // an id-like route, a number
  { id: 'op_u3', data: { route: ['watch'], stage: { s: 'card' } } },                             // non-strings
];

describe('CA-13 — the v1 plays census: read-only, count-only', () => {
  it('NO WRITE CALL: the script carries none (the gate it runs before anything else); a planted write is caught with its line', () => {
    const src = readFileSync(resolve(REPO, GATED_FILE), 'utf8');
    expect(writeCallsIn(src)).toEqual([]);
    for (const w of ['ref.set({})', 'ref.update({})', 'col.add(x)', 'ref.delete()', 'ref.create({})', 'db.run' + 'Transaction(f)', 'db.batch()', 'db.bulk' + 'Writer()', 'write' + 'Batch(db)', 'Field' + 'Value.increment(1)', 'db.recursive' + 'Delete(ref)']) expect(WRITE_PATTERN.test(w), w).toBe(true);
    const planted = src.replace('  const snap = await db.collectionGroup(PLAYS_GROUP).select(...SELECTED_FIELDS).get();', '  const snap = await db.collectionGroup(PLAYS_GROUP).select(...SELECTED_FIELDS).get(); await snap.docs[0].ref.update({ stage: \'retired\' });');
    expect(planted).not.toBe(src);
    const hits = writeCallsIn(planted);
    expect(hits).toHaveLength(1);
    expect(hits[0][1]).toMatch(/ref\.update\(/);
  });

  it('NO FILTER: the one read is the plays collection group with the two fields selected, and nothing else — no where, no order, no limit, no cursor', async () => {
    const { db, calls } = fakeDb(DOCS);
    const rows = await readPlays(db);
    expect(calls).toEqual([['collectionGroup', 'plays'], ['select', 'route', 'stage'], ['get']]);
    expect(PLAYS_GROUP).toBe('plays');
    expect(SELECTED_FIELDS).toEqual(['route', 'stage']);
    // only the two counted fields leave the read — never an id, a path, an owner or a note
    expect(rows.every((r) => Object.keys(r).sort().join() === 'route,stage')).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/op_|owner-XYZ|owner-ABC|agent-Q9|secret note|plays\//);
  });

  it('HONEST BUCKETS: the vocabulary\'s own routes (and the stored alias drill) and stages, then missing (absent or null) and unknown (any other value, a non-string included) — the counts add up', () => {
    expect(ROUTE_BUCKETS).toEqual([...CARD_ROUTES, 'drill', 'missing', 'unknown']);
    expect(STAGE_BUCKETS).toEqual([...CARD_STAGES, 'missing', 'unknown']);
    const r = countPlays(DOCS.map((d) => d.data));
    expect(r.total).toBe(10);
    expect(r.byRoute).toEqual({ watch: 1, offer: 1, set: 1, drill: 2, missing: 2, unknown: 3 });
    expect(r.byStage).toEqual({ card: 2, nominated: 2, testing: 0, tested: 1, installed: 0, retired: 1, missing: 1, unknown: 3 });
    expect(r.byRouteStage.drill).toMatchObject({ nominated: 1, retired: 1 });
    expect(Object.values(r.byRoute).reduce((a, b) => a + b, 0)).toBe(r.total);
    expect(Object.values(r.byStage).reduce((a, b) => a + b, 0)).toBe(r.total);
    expect(Object.values(r.byRouteStage).flatMap((row) => Object.values(row)).reduce((a, b) => a + b, 0)).toBe(r.total);
    // nothing to count is a census of zeros, not a failure
    expect(countPlays([])).toMatchObject({ total: 0, byRoute: { drill: 0 } });
  });

  it('NO ID OR OWNER IN THE OUTPUT: the rendered census holds counts under fixed bucket names only — no document id, path, owner, agent, note, nor any raw unknown value', async () => {
    const { db } = fakeDb(DOCS);
    const text = renderCensus(countPlays(await readPlays(db)));
    for (const leak of ['op_', 'owner-', 'agent-', 'secret note', 'plays/', 'practice', 'drilled', 'LEAK', '42']) expect(text, leak).not.toContain(leak);
    expect(text).toContain('stored v1 Practice entries (route drill): 2');
    // every line is a heading, a fixed label with its counts, or empty
    const allowed = new RegExp(`^(#.*|entries read: \\d+|stored v1 Practice entries \\(route drill\\): \\d+.*|- (${[...ROUTE_BUCKETS, ...STAGE_BUCKETS].join('|')}): [\\d · ]+|)$`);
    for (const line of text.split('\n')) expect(line, line).toMatch(allowed);
  });

  it('a failure prints its class alone — never its message (which could hold a path, an id or key material)', () => {
    const line = failureLine(new Error('PERMISSION_DENIED on projects/tradeseven/databases/(default)/documents/agents/agent-Q9r8s7/plays/op_d1 for svc@x.iam'));
    expect(line).toBe('[census-v1-plays] failed: Error');
    expect(failureLine(Object.assign(new TypeError('x'), {}))).toBe('[census-v1-plays] failed: TypeError');
  });
});

// ── the fix round's §2 review (report §9.7): the whole table, the drill line, the credential's prompt ──────────────
import { EventEmitter } from 'node:events';
import { readHidden, credentialText } from './census-film-room-v1-plays.mjs';

describe('CA-13 §2 review — the whole table pinned, the drill line, and the credential', () => {
  it('C3: the route x stage table, every cell, for the fixture documents', () => {
    const r = countPlays(DOCS.map((d) => d.data));
    const zero = Object.fromEntries(STAGE_BUCKETS.map((s) => [s, 0]));
    expect(r.byRouteStage).toEqual({
      watch: { ...zero, card: 1 },
      offer: { ...zero, nominated: 1 },
      set: { ...zero, tested: 1 },
      drill: { ...zero, nominated: 1, retired: 1 },
      missing: { ...zero, card: 1, missing: 1 },
      unknown: { ...zero, unknown: 3 },
    });
  });

  it('C4: the drill line says how many drill entries are not yet retired — a retired one needs nothing', () => {
    const r = countPlays(DOCS.map((d) => d.data));
    expect(renderCensus(r)).toContain('stored v1 Practice entries (route drill): 2, not yet retired: 1 — retire each of those from its receipt before on');
    const allRetired = countPlays([{ route: 'drill', stage: 'retired' }, { route: 'drill', stage: 'retired' }]);
    const line = renderCensus(allRetired).split('\n').find((l) => l.startsWith('stored v1'));
    expect(line).toBe('stored v1 Practice entries (route drill): 2, not yet retired: 0');
  });

  /** A fake terminal: stdin an emitter, stdout a recorder. */
  const fakeIo = (isTTY = false) => {
    const stdin = Object.assign(new EventEmitter(), { isTTY, raw: [], setRawMode(on) { this.raw.push(on); }, resume() {}, pause() {} });
    const written = [];
    return { stdin, stdout: { write: (s) => { written.push(s); } }, written };
  };

  it('C5: a multi-line service account JSON, pasted in chunks, is taken WHOLE (the input ends when it parses), nothing of it echoed; raw mode on and off on a terminal', async () => {
    const io = fakeIo(true);
    const sa = { type: 'service_account', project_id: 'p-test', private_key: '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n', client_email: 'x@y' };
    const pasted = JSON.stringify(sa, null, 2).replace(/\n/g, '\r\n');
    const p = readHidden('Q: ', io);
    for (let i = 0; i < pasted.length; i += 17) io.stdin.emit('data', pasted.slice(i, i + 17));
    const text = await p;
    expect(JSON.parse(text)).toEqual(sa);
    expect(io.written).toEqual(['Q: ', '\n']);
    expect(io.stdin.raw).toEqual([true, false]);
    expect(io.stdin.listenerCount('data')).toBe(0);
  });

  it('C5: Ctrl-D or the end of a piped input ends it; Ctrl-C cancels; the environment\'s value is used without asking, and the script reads no file but itself', async () => {
    const io = fakeIo();
    const p = readHidden('Q: ', io);
    io.stdin.emit('data', '{"a":\n');
    io.stdin.emit('data', '\u0004');
    expect(await p).toBe('{"a":\n');
    const io2 = fakeIo();
    const p2 = readHidden('Q: ', io2);
    io2.stdin.emit('data', '{"b"');
    io2.stdin.emit('end');
    expect(await p2).toBe('{"b"');
    const io3 = fakeIo();
    const p3 = readHidden('Q: ', io3);
    io3.stdin.emit('data', '\u0003');
    await expect(p3).rejects.toThrow('cancelled');
    let asked = 0;
    expect(await credentialText({ env: { FIREBASE_ADMIN_CREDENTIALS: '{"x":1}' }, ask: async () => { asked += 1; return ''; } })).toBe('{"x":1}');
    expect(await credentialText({ env: {}, ask: async () => { asked += 1; return '{"y":2}'; } })).toBe('{"y":2}');
    expect(asked).toBe(1);
    const code = readFileSync(resolve(REPO, GATED_FILE), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
    expect(code.match(/readFileSync\(/g)).toHaveLength(1);
    expect(code).toContain('readFileSync(path.join(REPO, GATED_FILE)');
    expect(code).not.toMatch(/\.env\.local|['"`]\.env['"`]|dotenv|loadEnv|existsSync/);
  });
});

describe('CA-13 §2 review — the rendered table, line for line', () => {
  it('the refuter\'s render mutants: every route row prints its OWN counts, in the stage columns\' order', () => {
    const text = renderCensus(countPlays(DOCS.map((d) => d.data)));
    const lines = text.split('\n');
    const at = lines.indexOf(`## route x stage (${STAGE_BUCKETS.join(' · ')})`);
    expect(at).toBeGreaterThan(0);
    expect(STAGE_BUCKETS).toEqual(['card', 'nominated', 'testing', 'tested', 'installed', 'retired', 'missing', 'unknown']);
    expect(lines.slice(at + 1, at + 1 + ROUTE_BUCKETS.length)).toEqual([
      '- watch: 1 · 0 · 0 · 0 · 0 · 0 · 0 · 0',
      '- offer: 0 · 1 · 0 · 0 · 0 · 0 · 0 · 0',
      '- set: 0 · 0 · 0 · 1 · 0 · 0 · 0 · 0',
      '- drill: 0 · 1 · 0 · 0 · 0 · 1 · 0 · 0',
      '- missing: 1 · 0 · 0 · 0 · 0 · 0 · 1 · 0',
      '- unknown: 0 · 0 · 0 · 0 · 0 · 0 · 0 · 3',
    ]);
    const byRoute = lines.slice(lines.indexOf('## by route') + 1, lines.indexOf('## by route') + 1 + ROUTE_BUCKETS.length);
    expect(byRoute).toEqual(['- watch: 1', '- offer: 1', '- set: 1', '- drill: 2', '- missing: 2', '- unknown: 3']);
    const byStage = lines.slice(lines.indexOf('## by stage') + 1, lines.indexOf('## by stage') + 1 + STAGE_BUCKETS.length);
    expect(byStage).toEqual(['- card: 2', '- nominated: 2', '- testing: 0', '- tested: 1', '- installed: 0', '- retired: 1', '- missing: 1', '- unknown: 3']);
  });
});
