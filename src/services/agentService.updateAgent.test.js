// src/services/agentService.updateAgent.test.js
//
// Release 2 settingsRev migration (D3) — the client-side blind-merge writer
// guard. updateAgent must REFUSE snapshot-feeding config fields (those may
// only move through the transactional server endpoints that bump
// agent.settingsRev) and keep allowing cosmetic writes (its one live caller,
// StarterKit, writes starterKitCompleted).
//
// Own module graph: firebase/firestore is stubbed here (the sibling
// agentService.test.js deliberately does not stub it — its equip tests never
// touch Firestore).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { updateDocMock } = vi.hoisted(() => ({ updateDocMock: vi.fn(async () => {}) }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((db, col, id) => ({ _col: col, _id: id })),
  addDoc: vi.fn(),
  updateDoc: updateDocMock,
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-ts'),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
}));
vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn() }));

const { updateAgent } = await import('./agentService.js');

beforeEach(() => {
  updateDocMock.mockClear();
});

describe('updateAgent — settings-guarded field denylist (Release 2 D3)', () => {
  it.each([
    ['config', { config: { risk: 90 } }],
    ['config dotted path', { 'config.risk': 90 }],
    ['archetype', { archetype: 'degen' }],
    ['activeRules', { activeRules: [] }],
    ['equippedBundleIds', { equippedBundleIds: [] }],
    ['equippedWatchlistId', { equippedWatchlistId: 'wl-1' }],
    ['standingLeans', { standingLeans: [] }],
    ['dials', { dials: { tempo: 'aggressive' } }],
    ['dials dotted path', { 'dials.tempo': 'aggressive' }],
    ['settingsRev', { settingsRev: 99 }],
    ['activeBattleId', { activeBattleId: 'b-1' }],
    ['deployedStrategy', { deployedStrategy: { guardrails: [] } }],
  ])('refuses %s loudly without touching Firestore', async (_label, updates) => {
    await expect(updateAgent('agent-1', updates)).rejects.toThrow(/settings-guarded/);
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it('still allows cosmetic writes (the StarterKit flag)', async () => {
    await updateAgent('agent-1', { starterKitCompleted: true });
    expect(updateDocMock).toHaveBeenCalledTimes(1);
    const [, payload] = updateDocMock.mock.calls[0];
    expect(payload).toMatchObject({ starterKitCompleted: true, updatedAt: 'server-ts' });
  });

  it('does not false-positive on prefix-similar cosmetic fields', async () => {
    await updateAgent('agent-1', { configNote: 'not a config write', archetypeTheme: 'dark' });
    expect(updateDocMock).toHaveBeenCalledTimes(1);
  });
});
