// src/services/huddleService.test.js
//
// Huddle S1.1 — the confirm request's body (Amendment E §E1; review HU-2): the sheet's acknowledgement (archetype → the
// revision its preview showed) reaches the POST body exactly, and is absent when there is none. Without it every confirm
// that previews would preview again. `fetchWithAuth` is the stand-in; nothing leaves the process.

import { afterEach, describe, expect, it, vi } from 'vitest';

const sent = vi.hoisted(() => []);
vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), getDocs: vi.fn(), limit: vi.fn(), orderBy: vi.fn(), query: vi.fn() }));
vi.mock('../utils/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(async (url, init) => {
    sent.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ revision: 'r1' }) };
  }),
}));

const { confirmHuddlePlan } = await import('./huddleService');

afterEach(() => { sent.length = 0; });

describe('confirmHuddlePlan: the body', () => {
  const plan = { stances: [{ kind: 'HOLD', ticker: 'AAA' }], lines: [] };

  it('carries `acknowledged` exactly when the sheet hands one', async () => {
    await confirmHuddlePlan({ etDate: '2026-11-09', baseRevision: 'r1', replacement: plan, acknowledged: { momentum_chaser: 'rev-tf' } });
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/api/huddle/confirm');
    expect(sent[0].init.method).toBe('POST');
    expect(JSON.parse(sent[0].init.body)).toEqual({ etDate: '2026-11-09', baseRevision: 'r1', replacement: plan, acknowledged: { momentum_chaser: 'rev-tf' } });
  });

  it('omits it when there is none (the first confirm)', async () => {
    await confirmHuddlePlan({ etDate: '2026-11-09', baseRevision: 'r1', replacement: plan });
    expect(JSON.parse(sent[0].init.body)).toEqual({ etDate: '2026-11-09', baseRevision: 'r1', replacement: plan });
  });
});
