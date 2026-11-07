// api/_utils/huddle/gather.test.js
//
// Huddle S1 — the gather step's evidence pack (spec V1.1 §5.3; Amendment A §A7; Amendment C V1.2 §C10), on an in-memory
// database: every holding, pick and opener paragraph is its own pack item with its own deterministic id. The verification
// run found every holding of one game sharing one id (record id = the battle id alone), so the pack kept only the first
// (build report RF-12); these rows pin the per-item ids.

import { describe, it, expect } from 'vitest';
import { gatherForPlayer } from './gather.js';
import { sessionOf } from './records.js';

const ET = '2026-11-02';
function memoryDb(collections) {
  const query = (name) => {
    const q = {
      where: () => q, orderBy: () => q, limit: () => q,
      get: async () => ({ docs: (collections[name] || []).map((d) => ({ id: d.id, exists: true, data: () => d.data })) }),
      doc: () => ({ get: async () => ({ exists: false, data: () => null }), collection: (sub) => query(sub) }),
    };
    return q;
  };
  return { collection: query, runTransaction: async () => { throw new Error('no transactions in this unit test'); } };
}
const battle = {
  id: 'b1',
  data: {
    ownerId: 'u1', agentId: 'casual-agent-u1', status: 'active', createdAt: '2026-10-31T03:17:19.850Z',
    portfolio: { star: [{ symbol: 'AAA' }, { symbol: 'BBB' }], core: [{ symbol: 'CCC' }], support: [{ symbol: 'DDD' }] },
    chatExchanges: [{ messageType: 'first_message', timestamp: '2026-10-31T03:17:32.873Z', agentResponse: 'First paragraph.\n\nSecond paragraph.' }],
  },
};
const deps = {
  fetchEodhdNews: async () => ({ status: 'skipped', items: [] }),
  fetchLastClose: async () => ({ lastClose: null, lastCloseAsOf: null, reason: 'no_bars', status: 'unavailable' }),
  fetchStoriesSince: async () => ({ status: 'ok', stories: [] }),
};

describe('the gather step\'s pack: one item, one id, per fact', () => {
  it('every holding of one game is its own item (four holdings → four holding items, four distinct ids)', async () => {
    const g = await gatherForPlayer(memoryDb({ agents: [], agentBattles: [battle] }), { uid: 'u1', etDate: ET, session: sessionOf(ET), shared: null, owner: 'u1#1', deps });
    const holdings = g.evidence.filter((e) => e.kind === 'holding');
    expect(holdings.map((e) => e.fact)).toEqual([
      'AAA is held in your BaggerBomb game (star).', 'BBB is held in your BaggerBomb game (star).',
      'CCC is held in your BaggerBomb game (core).', 'DDD is held in your BaggerBomb game (support).',
    ]);
    expect(new Set(holdings.map((e) => e.id)).size).toBe(4);
    expect(holdings.map((e) => e.source.recordId)).toEqual(['b1#AAA', 'b1#BBB', 'b1#CCC', 'b1#DDD']);
  });

  it('each opener paragraph is its own item, and no two items in the pack share an id', async () => {
    const g = await gatherForPlayer(memoryDb({ agents: [], agentBattles: [battle] }), { uid: 'u1', etDate: ET, session: sessionOf(ET), shared: null, owner: 'u1#1', deps });
    expect(g.evidence.filter((e) => e.kind === 'opener').map((e) => e.source.recordId)).toEqual(['b1#0', 'b1#1']);
    expect(new Set(g.evidence.map((e) => e.id)).size).toBe(g.evidence.length);
  });
});

describe('the gather step\'s source lines', () => {
  it('a source the morning did not check is named in words on its source_status item (never its key), and the label is not in the id', async () => {
    const g = await gatherForPlayer(memoryDb({ agents: [], agentBattles: [battle] }), {
      uid: 'u1', etDate: ET, session: sessionOf(ET), shared: { sources: { earnings: 'skipped', marketContext: 'error', macro: 'ok' } }, owner: 'u1#1', deps,
    });
    const status = g.evidence.filter((e) => e.kind === 'source_status');
    expect(status.map((e) => [e.source.recordId, e.source.label])).toEqual([
      ['eodhd', 'EODHD news'], ['newsfilter', 'newsfilter'], ['fantasytimes', 'FantasyTimes'], ['earnings', 'earnings calendar'], ['marketContext', 'market context'],
    ]);
  });
});
