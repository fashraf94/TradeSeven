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
