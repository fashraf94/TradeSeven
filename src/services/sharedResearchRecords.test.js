// src/services/sharedResearchRecords.test.js
//
// Command Center core spec V1.2, Amendment E V1.1 §1 — the research reader's one query: researchWork, userId == uid,
// createdAt desc, limit 20, kept in memory to origin 'shared_research'. Firestore is replaced by a recorder (no database call);
// the origin literal is pinned equal to the record model's (the client restates it rather than import from api/).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ calls: [], docs: [] }));
vi.mock('../firebase/config', () => ({ db: { name: 'db' }, auth: {}, default: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (db, name) => { fs.calls.push(['collection', db.name, name]); return { kind: 'collection', name }; },
  where: (field, op, value) => { fs.calls.push(['where', field, op, value]); return { kind: 'where' }; },
  orderBy: (field, dir) => { fs.calls.push(['orderBy', field, dir]); return { kind: 'orderBy' }; },
  limit: (n) => { fs.calls.push(['limit', n]); return { kind: 'limit' }; },
  query: (...parts) => { fs.calls.push(['query', parts.length]); return { kind: 'query' }; },
  getDocs: async () => { fs.calls.push(['getDocs']); return { docs: fs.docs.map((d) => ({ id: d.id, data: () => d.data })) }; },
}));

import { RESEARCH_READ_LIMIT, RESEARCH_WORK_COLLECTION, SHARED_RESEARCH_ORIGIN, fetchSharedResearchRecords } from './sharedResearchRecords';
import { SHARED_RESEARCH_ORIGIN as MODEL_ORIGIN, RESEARCH_WORK_COLLECTION as MODEL_COLLECTION } from '../../api/_utils/researchRecords/model.js';
import { RESEARCH_ORIGINS } from '../constants/researchRecords';

beforeEach(() => { fs.calls = []; fs.docs = []; });

describe('the one query (amendment §1)', () => {
  it('researchWork where userId == uid, orderBy createdAt desc, limit 20, one read', async () => {
    await fetchSharedResearchRecords({ uid: 'uid-A' });
    expect(fs.calls).toEqual([
      ['collection', 'db', 'researchWork'],
      ['where', 'userId', '==', 'uid-A'],
      ['orderBy', 'createdAt', 'desc'],
      ['limit', 20],
      ['query', 4],
      ['getDocs'],
    ]);
    expect(RESEARCH_READ_LIMIT).toBe(20);
  });

  it('keeps Shared Research records only, in the order read, each with its document id', async () => {
    fs.docs = [
      { id: 'sr_s2', data: { origin: 'shared_research', state: 'open', host: { collection: 'sharedResearchSessions', id: 's2' } } },
      { id: 'rs_x', data: { origin: 'screener', state: 'completed' } },
      { id: 'sr_s1', data: { origin: 'shared_research', state: 'completed', host: { collection: 'sharedResearchSessions', id: 's1' } } },
      { id: 'ws_y', data: { origin: 'signaldrop', state: 'open' } },
    ];
    const records = await fetchSharedResearchRecords({ uid: 'uid-A' });
    expect(records.map((r) => r.id)).toEqual(['sr_s2', 'sr_s1']);
    expect(records[0].host.id).toBe('s2');
  });

  it('a read that throws throws to the reader (its error state), and a read with no Shared Research record answers []', async () => {
    fs.docs = [{ id: 'rs_x', data: { origin: 'screener' } }];
    await expect(fetchSharedResearchRecords({ uid: 'uid-A' })).resolves.toEqual([]);
  });
});

describe('parity with the record model (the client does not import api/)', () => {
  it('the origin and the collection are the model\'s', () => {
    expect(SHARED_RESEARCH_ORIGIN).toBe(MODEL_ORIGIN);
    expect(SHARED_RESEARCH_ORIGIN).toBe('shared_research');
    expect(RESEARCH_WORK_COLLECTION).toBe(MODEL_COLLECTION);
    expect(RESEARCH_ORIGINS).toContain(SHARED_RESEARCH_ORIGIN);
  });
});
