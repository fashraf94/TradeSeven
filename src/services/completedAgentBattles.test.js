// src/services/completedAgentBattles.test.js
//
// Command Center slice S3 (ruling R-S3-5) — the one completed-battles read the
// legacy dashboards and the hub's ten-game window share: the legacy query
// unchanged, the limit before the client filter, training clones out and
// casual-clone games in, and a failure thrown for the caller to handle.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const fs = vi.hoisted(() => ({ calls: [], answer: null }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, name) => { fs.calls.push(['collection', name]); return { name }; }),
  where: vi.fn((...a) => { fs.calls.push(['where', ...a]); return a; }),
  orderBy: vi.fn((...a) => { fs.calls.push(['orderBy', ...a]); return a; }),
  limit: vi.fn((n) => { fs.calls.push(['limit', n]); return n; }),
  query: vi.fn((...a) => a),
  getDocs: vi.fn(async () => fs.answer()),
}));
vi.mock('../firebase/config', () => ({ db: { tag: 'db' } }));

const { fetchRecentCompletedAgentBattles } = await import('./completedAgentBattles');

const snap = (docs) => ({ docs: docs.map(({ id, ...data }) => ({ id, data: () => data })) });

beforeEach(() => { fs.calls = []; fs.answer = async () => snap([]); });

describe('fetchRecentCompletedAgentBattles', () => {
  it('the legacy query: ownerId, status completed, newest completion first, limited to max', async () => {
    await fetchRecentCompletedAgentBattles('uid-A', 10);
    expect(fs.calls).toEqual([
      ['collection', 'agentBattles'],
      ['where', 'ownerId', '==', 'uid-A'],
      ['where', 'status', '==', 'completed'],
      ['orderBy', 'completedAt', 'desc'],
      ['limit', 10],
    ]);
  });

  it('documents as { id, ...data }, newest first as answered; training clones dropped, casual-clone games kept', async () => {
    fs.answer = async () => snap([
      { id: 'c1', agentId: 'casual-agent-uid-A', status: 'completed' },
      { id: 't1', agentId: 'training-agent-group_1-uid-A', status: 'completed' },
      { id: 'r1', agentId: 'agent-A', status: 'completed' },
    ]);
    const rows = await fetchRecentCompletedAgentBattles('uid-A', 3);
    expect(rows.map((b) => b.id)).toEqual(['c1', 'r1']);
    expect(rows[0]).toMatchObject({ id: 'c1', agentId: 'casual-agent-uid-A' });
  });

  it('a failed read throws — the caller decides what a failure shows', async () => {
    fs.answer = async () => { throw new Error('failed-precondition'); };
    await expect(fetchRecentCompletedAgentBattles('uid-A', 10)).rejects.toThrow('failed-precondition');
  });
});

describe('fetchRecentCompletedAgentBattles — the limit is the caller\'s, and an odd document is not a failed read (S3 review T5-5)', () => {
  it('the legacy Review card reads 3 and the hub\'s window 10: the query is limited to the max each caller names', async () => {
    const limits = () => fs.calls.filter((c) => c[0] === 'limit');
    await fetchRecentCompletedAgentBattles('uid-A', 3);
    expect(limits()).toEqual([['limit', 3]]);
    fs.calls = [];
    await fetchRecentCompletedAgentBattles('uid-A', 10);
    expect(limits()).toEqual([['limit', 10]]);
    fs.calls = [];
    await fetchRecentCompletedAgentBattles('uid-A', 5);
    expect(limits()).toEqual([['limit', 5]]);
  });

  it('a document with no agentId (or one that is not text) is kept, never a failed read of the whole window', async () => {
    fs.answer = async () => snap([
      { id: 'bare', status: 'completed' },
      { id: 'odd', agentId: 7, status: 'completed' },
      { id: 'clone', agentId: 'training-agent-g-uid-A', status: 'completed' },
    ]);
    const rows = await fetchRecentCompletedAgentBattles('uid-A', 10);
    expect(rows.map((b) => b.id)).toEqual(['bare', 'odd']);
  });
});
